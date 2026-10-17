"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/http-meta";
import { fieldErrors, senderFormSchema, uuidSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
import { getT } from "@/i18n/server";

const LIST = "/admin/senders";
const detail = (id: string) => `${LIST}/${id}`;

function parseId(id: unknown) {
  const r = uuidSchema.safeParse(id);
  if (!r.success) throw new Error("Invalid id");
  return r.data;
}

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

async function takenBy(nameKey: string, exceptId?: string) {
  return db.sender.findFirst({
    where: { nameKey, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
}

/** إضافة مرسل يدوياً. */
export async function createSenderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const values = { name: String(formData.get("name") ?? ""), description: String(formData.get("description") ?? "") };
  const parsed = senderFormSchema.safeParse(values);
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.x), values };

  const { name, description } = parsed.data;
  const nameKey = name.toLowerCase();
  const existing = await takenBy(nameKey);
  if (existing) {
    return { fields: { name: t("senders.err.exists", { name: existing.name }) }, values };
  }

  try {
    const sender = await db.sender.create({
      data: { name, nameKey, description, source: "MANUAL", createdById: admin.id, updatedById: admin.id },
    });
    await audit({
      adminId: admin.id,
      action: "sender.create",
      entityType: "sender",
      entityId: sender.id,
      metadata: { name },
      ip: (await requestMeta()).ip,
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { fields: { name: t("senders.err.justAdded") }, values };
    throw err;
  }

  revalidatePath(LIST);
  return { ok: true, message: t("senders.ok.added", { name }) };
}

/** تعديل الاسم والوصف. المرسل القادم من الإكسل: تغيير حالة الأحرف فقط. */
export async function updateSenderAction(senderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const id = parseId(senderId);
  const values = { name: String(formData.get("name") ?? ""), description: String(formData.get("description") ?? "") };
  const parsed = senderFormSchema.safeParse(values);
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.x), values };

  const before = await db.sender.findUnique({ where: { id }, select: { name: true, nameKey: true, description: true, requestId: true } });
  if (!before) return { error: t("senders.err.notFound") };

  const { name, description } = parsed.data;
  const nameKey = name.toLowerCase();
  if (before.requestId && nameKey !== before.nameKey) {
    return {
      fields: { name: t("senders.err.excelCase", { upper: before.name.toUpperCase(), lower: before.name.toLowerCase() }) },
      values,
    };
  }
  if (nameKey !== before.nameKey) {
    const existing = await takenBy(nameKey, id);
    if (existing) return { fields: { name: t("senders.err.existsShort", { name: existing.name }) }, values };
  }

  try {
    await db.sender.update({ where: { id }, data: { name, nameKey, description, updatedById: admin.id } });
  } catch (err) {
    if (isUniqueViolation(err)) return { fields: { name: t("senders.err.used") }, values };
    throw err;
  }
  await audit({
    adminId: admin.id,
    action: "sender.update",
    entityType: "sender",
    entityId: id,
    metadata: { before: { name: before.name, description: before.description }, after: { name, description } },
  });
  revalidatePath(LIST);
  revalidatePath(detail(id));
  return { ok: true, message: t("clients.ok.saved") };
}

export async function toggleSenderAction(senderId: string) {
  const { admin } = await requireAdmin();
  const id = parseId(senderId);
  const sender = await db.sender.findUnique({ where: { id }, select: { isActive: true, name: true } });
  if (!sender) redirect(LIST);

  const isActive = !sender.isActive;
  await db.sender.update({ where: { id }, data: { isActive, updatedById: admin.id } });
  await audit({ adminId: admin.id, action: isActive ? "sender.enable" : "sender.disable", entityType: "sender", entityId: id, metadata: { name: sender.name } });
  revalidatePath(LIST);
  revalidatePath(detail(id));
}

/** الحذف للمرسل اليدوي غير المرتبط بالإكسل فقط؛ المرتبط يُعطَّل بدلاً من ذلك. */
export async function deleteSenderAction(senderId: string) {
  const { admin } = await requireAdmin();
  const id = parseId(senderId);
  const sender = await db.sender.findUnique({ where: { id }, select: { name: true, requestId: true } });
  if (!sender) redirect(LIST);
  if (sender.requestId) redirect(detail(id)); // لا يُحذف مرسل مرتبط بالإكسل

  await db.sender.delete({ where: { id } });
  await audit({ adminId: admin.id, action: "sender.delete", entityType: "sender", entityId: id, metadata: { name: sender.name } });
  revalidatePath(LIST);
  redirect(LIST);
}

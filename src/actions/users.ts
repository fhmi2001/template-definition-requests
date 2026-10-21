"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requireSuperAdmin } from "@/server/auth/dal";
import { hashPassword } from "@/server/auth/password";
import { audit } from "@/server/audit";
import { requestMeta } from "@/server/http-meta";
import { emailSchema, fieldErrors, uuidSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
import { getT } from "@/i18n/server";

/**
 * حسابات فريق لوحة الإدارة. كل ما هنا للمشرف الرئيسي وحده: العرض والإضافة والتعديل والتعطيل.
 * لا يُحذف أي حساب؛ التعطيل هو البديل.
 */

const LIST = "/admin/users";
const editPath = (id: string) => `${LIST}/${id}/edit`;

const nameSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(z.string().max(100, { error: "v.userName.long" }))
  .transform((v) => (v ? v : null));

const usernameSchema = z
  .string({ error: "v.username.required" })
  .trim()
  .toLowerCase()
  .min(3, { error: "v.username.short" })
  .max(50, { error: "v.username.long" })
  .regex(/^[a-z0-9._-]+$/, { error: "v.username.chars" });

const passwordSchema = z
  .string({ error: "v.password.required" })
  .min(12, { error: "v.password.short" })
  .max(200, { error: "v.password.long" });

const roleSchema = z.enum(["ADMIN", "SUPER_ADMIN"]);

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

async function revokeSessions(adminId: string) {
  await db.session.updateMany({ where: { adminId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** آخر مشرف رئيسي مفعّل لا يُعطَّل ولا تُسحب صلاحيته، حتى لا تُغلق لوحة الإدارة. */
async function isLastActiveSuperAdmin(adminId: string) {
  const others = await db.admin.count({ where: { role: "SUPER_ADMIN", isActive: true, id: { not: adminId } } });
  return others === 0;
}

/** البريد فريد بين حسابات الإدارة: يُرجع رسالة الخطأ إن كان لمشرف آخر. */
async function adminEmailTaken(email: string, exceptId?: string) {
  const other = await db.admin.findUnique({ where: { email }, select: { id: true, username: true } });
  return other && other.id !== exceptId ? other.username : null;
}

function parseId(id: unknown) {
  const r = uuidSchema.safeParse(id);
  if (!r.success) throw new Error("Invalid id");
  return r.data;
}

export async function createAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireSuperAdmin();
  const { t } = await getT();
  const values = {
    name: String(formData.get("name") ?? ""),
    username: String(formData.get("username") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "ADMIN"),
  };
  const parsed = z
    .object({ name: nameSchema, username: usernameSchema, email: emailSchema, role: roleSchema, password: passwordSchema })
    .safeParse({ ...values, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.x), values };
  const { name, username, email, role, password } = parsed.data;
  if (password !== String(formData.get("confirm") ?? "")) return { fields: { confirm: t("users.err.passwordMismatch") }, values };
  const owner = await adminEmailTaken(email);
  if (owner) return { fields: { email: t("users.err.adminEmailTaken", { username: owner }) }, values };

  let id: string;
  try {
    const created = await db.admin.create({
      data: { username, email, displayName: name, role, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    id = created.id;
  } catch (err) {
    // سباق نادر: اسم المستخدم أو البريد سُجّل للتو لحساب آخر
    if (isUniqueViolation(err)) return { error: t("users.err.uniqueRace"), values };
    throw err;
  }
  await audit({ adminId: admin.id, action: "admin.create", entityType: "admin", entityId: id, metadata: { username, email, role }, ip: (await requestMeta()).ip });
  revalidatePath(LIST);
  redirect(`${editPath(id)}?created=1`);
}

export async function updateAdminAction(adminId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireSuperAdmin();
  const { t } = await getT();
  const id = parseId(adminId);
  const target = await db.admin.findUnique({ where: { id }, select: { username: true, email: true, role: true } });
  if (!target) return { error: t("users.err.notFound") };

  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? target.role),
  };
  const parsed = z.object({ name: nameSchema, email: emailSchema, role: roleSchema }).safeParse(values);
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.x), values };
  const { name, email, role } = parsed.data;

  if (role !== target.role) {
    if (id === admin.id) return { fields: { role: t("users.err.selfRole") }, values };
    if (target.role === "SUPER_ADMIN" && (await isLastActiveSuperAdmin(id))) return { fields: { role: t("users.err.lastSuper") }, values };
  }
  const owner = await adminEmailTaken(email, id);
  if (owner) return { fields: { email: t("users.err.adminEmailTaken", { username: owner }) }, values };

  try {
    await db.admin.update({ where: { id }, data: { displayName: name, email, role } });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: t("users.err.uniqueRace"), values };
    throw err;
  }
  await audit({
    adminId: admin.id,
    action: "admin.update",
    entityType: "admin",
    entityId: id,
    metadata: { username: target.username, email: { from: target.email, to: email }, role: { from: target.role, to: role } },
    ip: (await requestMeta()).ip,
  });
  revalidatePath(LIST);
  revalidatePath(editPath(id));
  return { ok: true, message: t("users.ok.saved") };
}

/** كلمة مرور جديدة: تنتهي كل جلسات هذا الحساب، ويُلغى أي قفل بسبب محاولات خاطئة. */
export async function resetAdminPasswordAction(adminId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireSuperAdmin();
  const { t } = await getT();
  const id = parseId(adminId);
  const target = await db.admin.findUnique({ where: { id }, select: { username: true } });
  if (!target) return { error: t("users.err.notFound") };

  const parsed = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!parsed.success) return { fields: { password: t.x(parsed.error.issues[0].message) } };
  if (parsed.data !== String(formData.get("confirm") ?? "")) return { fields: { confirm: t("users.err.passwordMismatch") } };

  await db.admin.update({
    where: { id },
    data: { passwordHash: await hashPassword(parsed.data), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await revokeSessions(id);
  await audit({ adminId: admin.id, action: "admin.password_reset", entityType: "admin", entityId: id, metadata: { username: target.username }, ip: (await requestMeta()).ip });
  revalidatePath(editPath(id));
  return { ok: true, message: t("users.ok.passwordReset") };
}

export async function toggleAdminStatusAction(adminId: string, _prev: ActionState): Promise<ActionState> {
  const { admin } = await requireSuperAdmin();
  const { t } = await getT();
  const id = parseId(adminId);
  const target = await db.admin.findUnique({ where: { id }, select: { isActive: true, username: true, role: true } });
  if (!target) return { error: t("users.err.notFound") };

  const isActive = !target.isActive;
  if (!isActive) {
    if (id === admin.id) return { error: t("users.err.selfDisable") };
    if (target.role === "SUPER_ADMIN" && (await isLastActiveSuperAdmin(id))) return { error: t("users.err.lastSuper") };
  }
  await db.admin.update({ where: { id }, data: { isActive } });
  if (!isActive) await revokeSessions(id);
  await audit({
    adminId: admin.id,
    action: isActive ? "admin.enable" : "admin.disable",
    entityType: "admin",
    entityId: id,
    metadata: { username: target.username },
    ip: (await requestMeta()).ip,
  });
  revalidatePath(LIST);
  revalidatePath(editPath(id));
  return { ok: true, message: isActive ? t("users.ok.enabled") : t("users.ok.disabled") };
}

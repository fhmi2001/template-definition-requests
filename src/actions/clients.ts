"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/request";
import { SenderLinkConflict, checkSendersForClient, linkSenders, senderProblemsMessage } from "@/server/client-senders";
import { createClientSchema, emailListSchema, fieldErrors, senderNameListSchema, updateClientSchema, uuidSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
import { getT } from "@/i18n/server";
import type { T } from "@/i18n/translate";

const LIST = "/admin/clients";
const detail = (id: string) => `${LIST}/${id}`;

/** يرجع الإيميلات المسجّلة مسبقاً مع اسم عميلها. */
async function takenEmails(emails: string[]) {
  return db.user.findMany({
    where: { email: { in: emails } },
    select: { email: true, client: { select: { name: true } } },
  });
}

function takenMessage(rows: { email: string; client: { name: string } }[], t: T) {
  const list = rows.map((r) => t("item.withClient", { item: r.email, client: r.client.name }));
  return t("clients.err.emailsTaken", { n: rows.length, list });
}

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** يلغي كل جلسات دخول بريد أو عميل (عند التعطيل). */
async function revokeSessions(where: { userId: string } | { clientId: string }) {
  await db.session.updateMany({
    where:
      "userId" in where
        ? { userId: where.userId, revokedAt: null }
        : { user: { is: { clientId: where.clientId } }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function parseId(id: unknown) {
  const r = uuidSchema.safeParse(id);
  if (!r.success) throw new Error("Invalid id");
  return r.data;
}

// -----------------------------------------------------------------------------
// العميل
// -----------------------------------------------------------------------------

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const values = {
    name: String(formData.get("name") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    emails: String(formData.get("emails") ?? ""),
    senderNames: String(formData.get("senderNames") ?? ""),
  };
  const parsed = createClientSchema.safeParse(values);
  const names = senderNameListSchema.safeParse(values.senderNames);
  if (!parsed.success || !names.success) {
    return {
      fields: {
        ...(parsed.success ? {} : fieldErrors(parsed.error, t.x)),
        ...(names.success ? {} : { senderNames: t.x(names.error.issues[0].message) }),
      },
      values,
    };
  }

  const { name, notes, emails } = parsed.data;
  const taken = await takenEmails(emails);
  if (taken.length) return { fields: { emails: takenMessage(taken, t) }, values };

  const check = await checkSendersForClient(names.data, null);
  if (check.missing.length || check.taken.length) return { fields: { senderNames: senderProblemsMessage(check, t) }, values };

  try {
    const client = await db.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: { name, notes, createdById: admin.id, users: { create: emails.map((email) => ({ email })) } },
        select: { id: true },
      });
      await linkSenders(tx, c.id, check.link.map((x) => x.id));
      return c;
    });
    await audit({
      adminId: admin.id,
      action: "client.create",
      entityType: "client",
      entityId: client.id,
      metadata: { name, emails, senders: check.link.map((x) => x.name) },
      ip: (await requestMeta()).ip,
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: t("clients.err.emailRace"), values };
    if (err instanceof SenderLinkConflict) return { error: t("clients.err.senderRace"), values };
    throw err;
  }

  revalidatePath(LIST);
  const count = t("count.emails", { n: emails.length });
  const message = check.link.length
    ? t("clients.ok.createdWithSenders", { name, emails: count, senders: t("count.senders", { n: check.link.length }) })
    : t("clients.ok.created", { name, emails: count });
  return { ok: true, message };
}

export async function updateClientAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const id = parseId(clientId);
  const values = { name: String(formData.get("name") ?? ""), notes: String(formData.get("notes") ?? "") };
  const parsed = updateClientSchema.safeParse(values);
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.x), values };

  const before = await db.client.findUnique({ where: { id }, select: { name: true, notes: true } });
  if (!before) return { error: t("clients.err.notFound") };

  await db.client.update({ where: { id }, data: parsed.data });
  await audit({
    adminId: admin.id,
    action: "client.update",
    entityType: "client",
    entityId: id,
    metadata: { before, after: parsed.data },
  });
  revalidatePath(LIST);
  revalidatePath(detail(id));
  return { ok: true, message: t("clients.ok.saved") };
}

export async function toggleClientAction(clientId: string) {
  const { admin } = await requireAdmin();
  const id = parseId(clientId);
  const client = await db.client.findUnique({ where: { id }, select: { isActive: true } });
  if (!client) redirect(LIST);

  const isActive = !client.isActive;
  await db.client.update({ where: { id }, data: { isActive } });
  if (!isActive) await revokeSessions({ clientId: id });
  await audit({ adminId: admin.id, action: isActive ? "client.enable" : "client.disable", entityType: "client", entityId: id });
  revalidatePath(LIST);
  revalidatePath(detail(id));
}

export async function deleteClientAction(clientId: string) {
  const { admin } = await requireAdmin();
  const id = parseId(clientId);
  const client = await db.client.findUnique({ where: { id }, include: { users: { select: { email: true } } } });
  if (client) {
    // حذف العميل يحذف إيميلاته وجلساتها (Cascade)
    await db.client.delete({ where: { id } });
    await audit({
      adminId: admin.id,
      action: "client.delete",
      entityType: "client",
      entityId: id,
      metadata: { name: client.name, emails: client.users.map((u) => u.email) },
    });
  }
  revalidatePath(LIST);
  redirect(LIST);
}

// -----------------------------------------------------------------------------
// إيميلات العميل
// -----------------------------------------------------------------------------

export async function addEmailsAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const id = parseId(clientId);
  const values = { emails: String(formData.get("emails") ?? "") };
  const parsed = emailListSchema.safeParse(values.emails);
  if (!parsed.success) return { fields: { emails: t.x(parsed.error.issues[0].message) }, values };

  const emails = parsed.data;
  const taken = await takenEmails(emails);
  if (taken.length) return { fields: { emails: takenMessage(taken, t) }, values };

  const exists = await db.client.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { error: t("clients.err.notFound") };

  try {
    await db.user.createMany({ data: emails.map((email) => ({ email, clientId: id })) });
  } catch (err) {
    if (isUniqueViolation(err)) return { fields: { emails: t("clients.err.emailRace") }, values };
    throw err;
  }
  await audit({ adminId: admin.id, action: "client.emails_add", entityType: "client", entityId: id, metadata: { emails } });
  revalidatePath(LIST);
  revalidatePath(detail(id));
  return { ok: true, message: emails.length === 1 ? t("clients.ok.emailAdded") : t("clients.ok.emailsAdded", { n: emails.length }) };
}

export async function toggleEmailAction(userId: string) {
  const { admin } = await requireAdmin();
  const id = parseId(userId);
  const user = await db.user.findUnique({ where: { id }, select: { isActive: true, clientId: true, email: true } });
  if (!user) redirect(LIST);

  const isActive = !user.isActive;
  await db.user.update({ where: { id }, data: { isActive } });
  if (!isActive) await revokeSessions({ userId: id });
  await audit({
    adminId: admin.id,
    action: isActive ? "client.email_enable" : "client.email_disable",
    entityType: "client",
    entityId: user.clientId,
    metadata: { email: user.email },
  });
  revalidatePath(LIST);
  revalidatePath(detail(user.clientId));
}

export async function removeEmailAction(userId: string) {
  const { admin } = await requireAdmin();
  const id = parseId(userId);
  const user = await db.user.findUnique({ where: { id }, select: { clientId: true, email: true } });
  if (!user) redirect(LIST);

  await db.user.delete({ where: { id } }); // جلساته تُحذف معه
  await audit({
    adminId: admin.id,
    action: "client.email_remove",
    entityType: "client",
    entityId: user.clientId,
    metadata: { email: user.email },
  });
  revalidatePath(LIST);
  revalidatePath(detail(user.clientId));
}

// -----------------------------------------------------------------------------
// أسماء المرسلين المرتبطة بالعميل
// -----------------------------------------------------------------------------

export async function linkSendersAction(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const id = parseId(clientId);
  const values = { names: String(formData.get("names") ?? "") };
  const names = senderNameListSchema.safeParse(values.names);
  if (!names.success) return { fields: { names: t.x(names.error.issues[0].message) }, values };
  if (!names.data.length) return { fields: { names: t("clients.err.enterSender") }, values };

  const exists = await db.client.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { error: t("clients.err.notFound") };

  const check = await checkSendersForClient(names.data, id);
  if (check.missing.length || check.taken.length) return { fields: { names: senderProblemsMessage(check, t) }, values };
  if (!check.link.length) return { ok: true, message: t("clients.ok.alreadyLinked") };

  try {
    await db.$transaction((tx) => linkSenders(tx, id, check.link.map((x) => x.id)));
  } catch (err) {
    if (err instanceof SenderLinkConflict) return { error: t("clients.err.linkRace"), values };
    throw err;
  }
  await audit({
    adminId: admin.id,
    action: "client.senders_link",
    entityType: "client",
    entityId: id,
    metadata: { senders: check.link.map((x) => x.name) },
  });
  revalidatePath(LIST);
  revalidatePath(detail(id));
  const n = check.link.length;
  return { ok: true, message: n === 1 ? t("clients.ok.linkedOne", { name: check.link[0].name }) : t("clients.ok.linkedMany", { senders: t("count.senders", { n }) }) };
}

export async function unlinkSenderAction(senderId: string) {
  const { admin } = await requireAdmin();
  const id = parseId(senderId);
  const sender = await db.sender.findUnique({ where: { id }, select: { name: true, clientId: true } });
  if (!sender?.clientId) redirect(LIST);

  await db.sender.updateMany({ where: { id, clientId: sender.clientId }, data: { clientId: null } });
  await audit({
    adminId: admin.id,
    action: "client.sender_unlink",
    entityType: "client",
    entityId: sender.clientId,
    metadata: { sender: sender.name },
  });
  revalidatePath(LIST);
  revalidatePath(detail(sender.clientId));
  revalidatePath(`/admin/senders/${id}`);
}

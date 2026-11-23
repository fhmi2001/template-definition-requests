import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { needsAuthorityRef } from "@/lib/review-status";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { messageSignature, sanitizeSpecs } from "@/lib/template-rules";
import { referenceText } from "@/server/requests";
import { sendEmail } from "@/server/email/send";
import { renderRequestReceived, renderStatusChanged } from "@/server/email/request-emails";

/** بريد العميل لإشعارات الطلب: من قدّمه، وإلا أول بريد مفعّل لنفس العميل. */
export async function requestRecipient(request: { clientId: string; user: { email: string; isActive: boolean } | null }) {
  if (request.user?.isActive) return request.user.email;
  const other = await db.user.findFirst({
    where: { clientId: request.clientId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  return other?.email ?? request.user?.email ?? null;
}

/**
 * يرسل بريد الإشعار لتغيير حالة (أو للاستلام عند التقديم) ويسجّل النتيجة في السجل.
 * يُستدعى بعد الرد على المستخدم (after) حتى لا ينتظر الإرسال.
 */
export async function notifyStatusChange(changeId: string) {
  try {
    const change = await db.requestStatusChange.findUnique({
      where: { id: changeId },
      include: {
        request: {
          include: {
            client: { select: { name: true } },
            user: { select: { email: true, isActive: true } },
            sender: { select: { clientName: true } },
          },
        },
      },
    });
    if (!change) return;
    const r = change.request;
    const to = await requestRecipient(r);
    if (!to) {
      await db.requestStatusChange.update({ where: { id: changeId }, data: { emailStatus: "SKIPPED", emailTo: null, emailError: "no client email" } });
      return;
    }
    const locale = isLocale(r.locale) ? r.locale : DEFAULT_LOCALE;
    const data = {
      ref: referenceText(r.referenceNo),
      authorityRef: r.authorityRef,
      submittedAt: r.submittedAt,
      clientName: r.sender?.clientName ?? r.client.name,
      senderName: r.senderName,
      senderType: r.senderType,
      awarenessClientName: r.awarenessClientName,
      templateName: r.templateName,
      templateDescription: r.templateDescription,
      content: r.content,
      signature: messageSignature(r.senderType, r.awarenessClientName),
      specs: sanitizeSpecs(r.variables),
      customerType: r.customerType,
      exceptions: r.exceptions,
      status: change.toStatus,
      reason: change.reason,
    };
    const mail = change.adminId === null && change.toStatus === "RECEIVED" ? renderRequestReceived(locale, data) : renderStatusChanged(locale, data);
    const result = await sendEmail({ to, ...mail });
    await db.requestStatusChange.update({
      where: { id: changeId },
      data: { emailTo: to, emailStatus: result.status, emailError: result.error ?? null },
    });
  } catch (err) {
    console.error("[request-email] تعذّر إرسال إشعار الطلب", changeId, err);
    await db.requestStatusChange
      .update({ where: { id: changeId }, data: { emailStatus: "FAILED", emailError: String(err).slice(0, 480) } })
      .catch(() => {});
  }
}

/** عدد الإشعارات الأقصى في عملية واحدة: الإرسال متتابع بفاصل قصير لتجنب حد معدل Resend. */
export const NOTIFY_BATCH_MAX = 25;
const NOTIFY_GAP_MS = 600;

/** يرسل إشعارات عدة تغييرات بالتتابع (بعد الرد على المشرف). */
export async function notifyMany(changeIds: string[]) {
  for (const [i, id] of changeIds.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, NOTIFY_GAP_MS));
    await notifyStatusChange(id);
  }
}

/** علامة في السجل لتغيير حالة بلا إشعار (اختاره المشرف). */
export const SILENT_MARK = "silent";

/**
 * ينفّذ تغيير حالة واحد (تحديث مشروط + سجل + تدقيق). يُرجع معرّف السجل، أو null إن غيّره مشرف آخر للتو.
 * المرجع هنا هو الحالة التي قُرئت: لا يُكتب فوق تغيير أحدث.
 * بلا إشعار: يُسجَّل «لم يُرسل» ولا يُرسل شيء.
 */
export async function applyStatusChange(args: {
  /** null = تغيير آلي عبر واجهة الوكلاء (agent API) وليس من مشرف. */
  adminId: string | null;
  ip: string | null;
  request: { id: string; reviewStatus: ReviewStatus | null; referenceNo: number | null };
  status: ReviewStatus;
  reason: string;
  authorityRef: string | null;
  silent: boolean;
  bulk?: boolean;
  /** يُسجَّل في التدقيق عند التغيير عبر واجهة الوكلاء. */
  via?: "agent-api";
}): Promise<string | null> {
  const { request, status, reason, authorityRef, silent } = args;
  const now = new Date();
  const changeId = await db.$transaction(async (tx) => {
    const res = await tx.templateRequest.updateMany({
      where: { id: request.id, status: "SUBMITTED", reviewStatus: request.reviewStatus },
      data: {
        reviewStatus: status,
        rejectionReason: status === "REJECTED" ? reason : null,
        reviewedAt: now,
        ...(needsAuthorityRef(status) && authorityRef ? { authorityRef } : {}),
      },
    });
    if (res.count !== 1) return null;
    const change = await tx.requestStatusChange.create({
      data: {
        requestId: request.id,
        fromStatus: request.reviewStatus,
        toStatus: status,
        reason: status === "REJECTED" ? reason : null,
        adminId: args.adminId,
        createdAt: now,
        ...(silent ? { emailStatus: "SKIPPED" as const, emailError: SILENT_MARK } : {}),
      },
      select: { id: true },
    });
    return change.id;
  });
  if (!changeId) return null;
  await audit({
    adminId: args.adminId,
    action: "request.status_change",
    entityType: "template_request",
    entityId: request.id,
    metadata: {
      referenceNo: request.referenceNo,
      from: request.reviewStatus,
      to: status,
      ...(status === "REJECTED" ? { reason } : {}),
      ...(needsAuthorityRef(status) && authorityRef ? { authorityRef } : {}),
      ...(silent ? { silent: true } : {}),
      ...(args.bulk ? { bulk: true } : {}),
      ...(args.via ? { via: args.via } : {}),
    },
    ip: args.ip ?? undefined,
  });
  return changeId;
}

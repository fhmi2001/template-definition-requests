import "server-only";
import { db } from "@/server/db";
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

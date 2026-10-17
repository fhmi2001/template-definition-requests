import "server-only";
import { notFound, redirect } from "next/navigation";
import { db } from "@/server/db";
import { findClientSender } from "@/server/client-senders";
import { uuidSchema, awarenessClientNameSchema, templateSchema } from "@/lib/validation";
import { AWARENESS, allowedSenderTypes } from "@/lib/sender-types";
import type { MessageKey } from "@/i18n/translate";
import { evaluateTemplate, messageSignature, normalizeTemplate, sanitizeSpecs, type Evaluation, type VariableSpec } from "@/lib/template-rules";

export const requestPath = {
  sender: (id: string) => `/home?draft=${id}`,
  type: (id: string) => `/request/${id}/type`,
  template: (id: string) => `/request/${id}/template`,
  content: (id: string) => `/request/${id}/content`,
  summary: (id: string) => `/request/${id}/summary`,
  submitted: (id: string) => `/request/${id}/submitted`,
  pledgeTemplate: (id: string) => `/request/${id}/pledge-template`,
  attachment: (id: string, attachmentId: string) => `/request/${id}/attachments/${attachmentId}`,
};

/** رقم الطلب كما يظهر للعميل: TDR-000123 */
export const referenceText = (n: number | null) => (n ? `TDR-${String(n).padStart(6, "0")}` : "—");

/** طلب يتبع هذا العميل فقط (لا نثق بالمعرّف القادم من الرابط). */
export async function getOwnRequest(clientId: string, id: unknown) {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return null;
  return db.templateRequest.findFirst({ where: { id: parsed.data, clientId } });
}

/** مسودة تتبع هذا العميل. */
export async function getDraft(clientId: string, id: unknown) {
  const r = await getOwnRequest(clientId, id);
  return r?.status === "DRAFT" ? r : null;
}

/** المسودة مع اسم المرسل، بشرط أن يبقى المرسل مرتبطاً بالعميل وظاهراً له. */
export async function getDraftWithSender(clientId: string, id: unknown) {
  const draft = await getDraft(clientId, id);
  if (!draft) return null;
  const sender = draft.senderId ? await findClientSender(clientId, draft.senderId) : null;
  return { draft, sender };
}

/** لصفحات المراحل: الطلب المقدَّم يذهب لصفحة التأكيد، وغير الموجود 404. */
export async function loadDraftForPage(clientId: string, id: unknown) {
  const request = await getOwnRequest(clientId, id);
  if (!request) notFound();
  if (request.status !== "DRAFT") redirect(requestPath.submitted(request.id));
  const sender = request.senderId ? await findClientSender(clientId, request.senderId) : null;
  return { draft: request, sender };
}

export async function getPledge(requestId: string) {
  return db.requestAttachment.findFirst({
    where: { requestId, kind: "PLEDGE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, size: true, mimeType: true, createdAt: true },
  });
}

export const draftSpecs = (variables: unknown): VariableSpec[] => sanitizeSpecs(variables);

type Draft = NonNullable<Awaited<ReturnType<typeof getDraft>>>;
type Sender = NonNullable<Awaited<ReturnType<typeof findClientSender>>>;

/**
 * تحقق كامل من كل المراحل قبل التقديم (البيانات قد تتغير بعد حفظ كل مرحلة).
 * يعيد أول مرحلة فيها مشكلة لإرسال العميل إليها.
 */
export async function checkDraftComplete(
  draft: Draft,
  sender: Sender | null,
): Promise<{ ok: true; evaluation: Evaluation } | { ok: false; step: "sender" | "type" | "template" | "content"; message: MessageKey }> {
  if (!sender) return { ok: false, step: "sender", message: "req.check.senderGone" };
  if (!draft.senderType || !allowedSenderTypes(sender.senderTypes).includes(draft.senderType)) {
    return { ok: false, step: "type", message: "req.check.chooseType" };
  }
  if (draft.senderType === AWARENESS && !awarenessClientNameSchema.safeParse(draft.awarenessClientName ?? "").success) {
    return { ok: false, step: "type", message: "req.check.clientName" };
  }
  if (!templateSchema.safeParse({ templateName: draft.templateName ?? "", templateDescription: draft.templateDescription ?? "" }).success) {
    return { ok: false, step: "template", message: "req.check.template" };
  }
  const normalized = normalizeTemplate(draft.content ?? "", draftSpecs(draft.variables));
  const evaluation = evaluateTemplate({
    text: normalized.text,
    signature: messageSignature(draft.senderType, draft.awarenessClientName),
    variables: normalized.specs,
    customerType: sender.customerType,
    hasPledge: !!(await getPledge(draft.id)),
  });
  if (!evaluation.ok) return { ok: false, step: "content", message: "req.check.content" };
  return { ok: true, evaluation };
}

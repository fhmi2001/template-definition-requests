import "server-only";
import { notFound, redirect } from "next/navigation";
import { db } from "@/server/db";
import { availableSenderSelect, findClientSender, senderVisibleTo } from "@/server/client-senders";
import { uuidSchema, awarenessClientNameSchema, templateSchema } from "@/lib/validation";
import { AWARENESS, allowedSenderTypes, isTypeBlocked } from "@/lib/sender-types";
import type { MessageKey } from "@/i18n/translate";
import {
  comparableMessage,
  evaluateTemplate,
  messageSignature,
  normalizeTemplate,
  sanitizeSpecs,
  type Evaluation,
  type VariableSpec,
} from "@/lib/template-rules";
import type { ReviewStatus } from "@/generated/prisma/enums";

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

/**
 * رابط مرحلة يُفتح من صفحة المراجعة: الحفظ يعيد العميل إليها مباشرة
 * بدل المرور بالمراحل التالية واحدة واحدة.
 */
export const fromReview = (href: string) => `${href}${href.includes("?") ? "&" : "?"}from=review`;
export const isFromReview = (value: unknown) => value === "review";

/** المراحل المكتملة بالترتيب (المرسل، النوع، بيانات القالب، النص، المراجعة) لروابط شريط المراحل. */
export function stepsDone(draft: {
  senderId: string | null;
  senderType: string | null;
  awarenessClientName: string | null;
  templateName: string | null;
  templateDescription: string | null;
  content: string | null;
}) {
  const sender = !!draft.senderId;
  const type = !!draft.senderType && (draft.senderType !== AWARENESS || !!draft.awarenessClientName);
  const template = !!draft.templateName && !!draft.templateDescription;
  const content = !!draft.content?.trim();
  return [sender, type, template, content, sender && type && template && content];
}

/**
 * يحذف طلبات هذا المستخدم غير المكتملة، عدا ما حفظه بـ«حفظ والعودة لاحقاً».
 * يُستدعى عند بدء طلب جديد وعند الدخول والخروج، فيبدأ العميل كل مرة من جديد.
 * المرفقات (خطاب التعهد) تُحذف معها (onDelete: Cascade).
 */
export async function purgeAbandonedDrafts(userId: string, exceptId?: string) {
  await db.templateRequest.deleteMany({
    where: { userId, status: "DRAFT", keepDraft: false, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
}

export type DuplicateRequest = {
  id: string;
  referenceNo: number | null;
  authorityRef: string | null;
  reviewStatus: ReviewStatus | null;
  submittedAt: Date | null;
  templateName: string | null;
  senderName: string;
  senderType: string | null;
  /** الرسالة كما أُرسلت (النص + سطر Client Name) */
  message: string;
};

/**
 * طلب مقدَّم سابق يطابق هذه المسودة في الشروط الأربعة معاً:
 * حالته ليست «مرفوض»، ونفس اسم المرسل، ونفس نوع المرسل، ونفس نص الرسالة كما تُرسل
 * (مع سطر Client Name للتوعوي، ومطابقة حرفية بعد توحيد نهايات الأسطر والمسافات الطرفية).
 * اسم المرسل لا يرتبط إلا بعميل واحد، فالبحث بالاسم يغطي النطاق الصحيح. يعيد الأحدث.
 */
export async function findDuplicateRequest(draft: {
  id: string;
  senderName: string;
  senderType: string | null;
  awarenessClientName: string | null;
  content: string | null;
}): Promise<DuplicateRequest | null> {
  if (!draft.senderType || !draft.content?.trim()) return null;
  const target = comparableMessage(draft.content, messageSignature(draft.senderType, draft.awarenessClientName));
  const candidates = await db.templateRequest.findMany({
    where: {
      id: { not: draft.id },
      status: "SUBMITTED",
      senderName: draft.senderName,
      senderType: draft.senderType,
      OR: [{ reviewStatus: null }, { reviewStatus: { not: "REJECTED" } }],
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      referenceNo: true,
      authorityRef: true,
      reviewStatus: true,
      submittedAt: true,
      templateName: true,
      senderName: true,
      senderType: true,
      awarenessClientName: true,
      content: true,
    },
  });
  for (const c of candidates) {
    const message = comparableMessage(c.content ?? "", messageSignature(c.senderType, c.awarenessClientName));
    if (message === target) {
      const { awarenessClientName: _a, content: _c, ...rest } = c;
      return { ...rest, message };
    }
  }
  return null;
}

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
const pledgeSelect = { id: true, fileName: true, size: true, mimeType: true, createdAt: true } as const;

/**
 * الطلب مع مرسله (بشروط ظهوره للعميل) وآخر خطاب تعهد في استعلام واحد،
 * بدل ثلاثة استعلامات متتالية (الطلب ثم المرسل ثم الخطاب). كل رحلة لقاعدة البيانات لها كلفة زمنية.
 */
async function loadRequestBundle(clientId: string, id: unknown) {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return null;
  const row = await db.templateRequest.findFirst({
    where: { id: parsed.data, clientId },
    include: {
      sender: { select: { ...availableSenderSelect, clientId: true, isActive: true, missingFromFile: true } },
      attachments: { where: { kind: "PLEDGE" }, orderBy: { createdAt: "desc" }, take: 1, select: pledgeSelect },
    },
  });
  if (!row) return null;
  const { sender: rawSender, attachments, ...request } = row;
  const visible = senderVisibleTo(rawSender, clientId);
  const sender = visible
    ? {
        id: visible.id,
        name: visible.name,
        clientName: visible.clientName,
        customerType: visible.customerType,
        senderTypes: visible.senderTypes,
        senderExpiryDate: visible.senderExpiryDate,
      }
    : null;
  return { request, sender, pledge: attachments[0] ?? null };
}

export async function getDraftWithSender(clientId: string, id: unknown) {
  const b = await loadRequestBundle(clientId, id);
  if (!b || b.request.status !== "DRAFT") return null;
  return { draft: b.request, sender: b.sender, pledge: b.pledge };
}

/** لصفحات المراحل: الطلب المقدَّم يذهب لصفحة التأكيد، وغير الموجود 404. */
export async function loadDraftForPage(clientId: string, id: unknown) {
  const b = await loadRequestBundle(clientId, id);
  if (!b) notFound();
  if (b.request.status !== "DRAFT") redirect(requestPath.submitted(b.request.id));
  return { draft: b.request, sender: b.sender, pledge: b.pledge };
}

export async function getPledge(requestId: string) {
  return db.requestAttachment.findFirst({
    where: { requestId, kind: "PLEDGE" },
    orderBy: { createdAt: "desc" },
    select: pledgeSelect,
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
  /** خطاب التعهد إن كان محمّلاً مسبقاً مع الطلب (يوفّر استعلاماً) */
  pledge?: { id: string } | null,
): Promise<
  | { ok: true; evaluation: Evaluation }
  | { ok: false; step: "sender" | "type" | "template" | "content"; message: MessageKey; duplicate?: DuplicateRequest }
> {
  if (!sender) return { ok: false, step: "sender", message: "req.check.senderGone" };
  if (draft.senderType && isTypeBlocked(draft.senderType, sender.name)) {
    return { ok: false, step: "type", message: "req.check.adNameTooLong" };
  }
  if (!draft.senderType || !allowedSenderTypes(sender.name).includes(draft.senderType)) {
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
    hasPledge: pledge !== undefined ? !!pledge : !!(await getPledge(draft.id)),
  });
  if (!evaluation.ok) return { ok: false, step: "content", message: "req.check.content" };
  // طلب مقدَّم غير مرفوض بنفس اسم المرسل ونوعه ونص الرسالة: لا يُقدَّم مرة أخرى
  const duplicate = await findDuplicateRequest(draft);
  if (duplicate) return { ok: false, step: "content", message: "req.check.duplicate", duplicate };
  return { ok: true, evaluation };
}

"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionState } from "@/lib/action-state";
import { awarenessClientNameSchema, fieldErrors, templateSchema, uuidSchema } from "@/lib/validation";
import { AWARENESS, allowedSenderTypes } from "@/lib/sender-types";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/dal";
import { findClientSender } from "@/server/client-senders";
import { checkDraftComplete, getDraft, getDraftWithSender, getOwnRequest, getPledge, requestPath } from "@/server/requests";
import {
  TEMPLATE_MAX_LENGTH,
  charCount,
  cleanTemplateText,
  evaluateTemplate,
  messageSignature,
  normalizeTemplate,
  sanitizeSpecs,
  type VariableSpec,
} from "@/lib/template-rules";
import type { Prisma } from "@/generated/prisma/client";
import { getT } from "@/i18n/server";
import { msg } from "@/i18n/translate";
import { notifyStatusChange } from "@/server/request-review";

/**
 * المرحلة 1: اختيار اسم مرسل واحد.
 * لا نثق بالمعرّف القادم من المتصفح: نتحقق في الخادم أنه يتبع عميل المستخدم.
 * تُنشأ مسودة الطلب هنا، أو تُحدَّث إن عاد العميل لتغيير اسم المرسل.
 */
export async function chooseSenderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, client } = await requireUser();
  const { t } = await getT();
  const raw = formData.getAll("senderId").map(String).filter(Boolean);

  if (raw.length === 0) return { error: t("req.err.chooseOne") };
  if (raw.length > 1) return { error: t("req.err.onlyOne") };

  const id = uuidSchema.safeParse(raw[0]);
  const sender = id.success ? await findClientSender(client.id, id.data) : null;
  if (!sender) {
    return { error: t("req.err.senderUnavailable") };
  }

  const draft = await getDraft(client.id, formData.get("draftId"));
  let draftId: string;
  if (draft) {
    draftId = draft.id;
    if (draft.senderId !== sender.id) {
      // اسم مرسل آخر: أنواعه قد تختلف، فنعيد اختيار النوع
      await db.templateRequest.update({
        where: { id: draft.id },
        data: { senderId: sender.id, senderName: sender.name, senderType: null, awarenessClientName: null },
      });
    }
  } else {
    const created = await db.templateRequest.create({
      data: { clientId: client.id, userId: user.id, senderId: sender.id, senderName: sender.name },
      select: { id: true },
    });
    draftId = created.id;
  }
  redirect(requestPath.type(draftId));
}

/** المرحلة 2: نوع مرسل واحد (من أنواع المرسل المسجّلة)، و Client Name إلزامي عند Awareness. */
export async function saveSenderTypeAction(draftId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { client } = await requireUser();
  const { t } = await getT();
  const found = await getDraftWithSender(client.id, draftId);
  if (!found) return { error: t("req.err.notFoundStart") };
  if (!found.sender) return { error: t("req.err.senderGone") };

  const types = formData.getAll("senderType").map(String).filter(Boolean);
  const values = { senderType: types[0] ?? "", clientName: String(formData.get("clientName") ?? "") };
  if (types.length === 0) return { fields: { senderType: t("req.f.chooseType") }, values };
  if (types.length > 1) return { fields: { senderType: t("req.f.oneType") }, values };
  if (!allowedSenderTypes(found.sender.senderTypes).includes(values.senderType)) {
    return { fields: { senderType: t("req.f.typeUnavailable") }, values };
  }

  let awarenessClientName: string | null = null;
  if (values.senderType === AWARENESS) {
    const parsed = awarenessClientNameSchema.safeParse(values.clientName);
    if (!parsed.success) return { fields: { clientName: t.x(parsed.error.issues[0].message) }, values };
    awarenessClientName = parsed.data;
  }

  await db.templateRequest.update({
    where: { id: found.draft.id },
    data: { senderType: values.senderType, awarenessClientName },
  });
  redirect(requestPath.template(found.draft.id));
}

/** المرحلة 3: اسم القالب ووصفه (إلزاميان). */
export async function saveTemplateAction(draftId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { client } = await requireUser();
  const { t } = await getT();
  const found = await getDraftWithSender(client.id, draftId);
  if (!found) return { error: t("req.err.notFoundStart") };
  if (!found.sender) return { error: t("req.err.senderGone") };
  if (!found.draft.senderType) redirect(requestPath.type(found.draft.id));

  const values = {
    templateName: String(formData.get("templateName") ?? ""),
    templateDescription: String(formData.get("templateDescription") ?? ""),
  };
  const parsed = templateSchema.safeParse(values);
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.x), values };

  await db.templateRequest.update({ where: { id: found.draft.id }, data: parsed.data });
  redirect(requestPath.content(found.draft.id));
}

// -----------------------------------------------------------------------------
// المرحلة 4: نص القالب
// -----------------------------------------------------------------------------

function readContent(formData: FormData): { text: string; specs: VariableSpec[] } {
  let raw: unknown = [];
  try {
    raw = JSON.parse(String(formData.get("variables") ?? "[]"));
  } catch {
    raw = [];
  }
  return normalizeTemplate(cleanTemplateText(String(formData.get("content") ?? "")), sanitizeSpecs(raw));
}

async function loadContentDraft(draftId: string) {
  const { user, client } = await requireUser();
  const found = await getDraftWithSender(client.id, draftId);
  return { user, client, found };
}

/** يحفظ النص والمتغيرات كما هي (حتى لو لم تتحقق الشروط) حتى لا يضيع عمل العميل. */
async function storeContent(draftId: string, text: string, specs: VariableSpec[], customerType: string | null, exceptions: string[]) {
  await db.templateRequest.update({
    where: { id: draftId },
    data: { content: text, variables: specs as unknown as Prisma.InputJsonValue, customerType, exceptions },
  });
}

/** «التالي»: يُحفظ النص، ولا ينتقل للمراجعة إلا إذا تحققت كل الشروط. */
export async function saveContentAction(draftId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { found } = await loadContentDraft(draftId);
  const { t } = await getT();
  if (!found) return { error: t("req.err.notFoundOrSubmitted") };
  if (!found.sender) return { error: t("req.err.senderGone") };
  if (!found.draft.templateName || !found.draft.templateDescription) redirect(requestPath.template(found.draft.id));

  const { text, specs } = readContent(formData);
  if (charCount(text) > TEMPLATE_MAX_LENGTH) return { error: t("req.err.contentTooLong", { max: TEMPLATE_MAX_LENGTH }) };
  const evaluation = evaluateTemplate({
    text,
    signature: messageSignature(found.draft.senderType, found.draft.awarenessClientName),
    variables: specs,
    customerType: found.sender.customerType,
    hasPledge: !!(await getPledge(found.draft.id)),
  });
  await storeContent(found.draft.id, text, specs, found.sender.customerType, evaluation.exceptions);
  if (!evaluation.ok) {
    const failed = evaluation.rules.filter((r) => r.status === "fail" || r.status === "pending").map((r) => msg(t, r.title));
    return { error: t("req.err.rulesFailed", { list: failed }) };
  }
  redirect(requestPath.summary(found.draft.id));
}

/** «حفظ والعودة لاحقاً»: يحفظ دون اشتراط تحقق الشروط (مثلاً أثناء تجهيز خطاب التعهد). */
export async function saveContentDraftAction(draftId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { found } = await loadContentDraft(draftId);
  const { t } = await getT();
  if (!found) return { error: t("req.err.notFoundOrSubmitted") };
  if (!found.sender) return { error: t("req.err.senderGone") };

  const { text, specs } = readContent(formData);
  if (charCount(text) > TEMPLATE_MAX_LENGTH) return { error: t("req.err.contentTooLong", { max: TEMPLATE_MAX_LENGTH }) };
  const evaluation = evaluateTemplate({
    text,
    signature: messageSignature(found.draft.senderType, found.draft.awarenessClientName),
    variables: specs,
    customerType: found.sender.customerType,
    hasPledge: false,
  });
  await storeContent(found.draft.id, text, specs, found.sender.customerType, evaluation.exceptions);
  return { ok: true, message: t("req.ok.draftSaved") };
}

// -----------------------------------------------------------------------------
// خطاب التعهد
// -----------------------------------------------------------------------------

const PLEDGE_MAX_BYTES = 4 * 1024 * 1024;

/** نحدد نوع الملف من محتواه لا من اسمه. */
function sniffPledge(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  return null;
}

export async function uploadPledgeAction(draftId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, found } = await loadContentDraft(draftId);
  const { t } = await getT();
  if (!found) return { error: t("req.err.notFoundOrSubmitted") };

  const file = formData.get("pledge");
  if (!(file instanceof File) || file.size === 0) return { error: t("req.err.pledgeChoose") };
  if (file.size > PLEDGE_MAX_BYTES) return { error: t("req.err.pledgeSize") };
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffPledge(buf);
  if (!kind) return { error: t("req.err.pledgeType") };

  const base = file.name.replace(/[\\/\r\n"]/g, "_").replace(/\.[^.]*$/, "").slice(0, 200) || "pledge";
  await db.$transaction([
    db.requestAttachment.deleteMany({ where: { requestId: found.draft.id, kind: "PLEDGE" } }),
    db.requestAttachment.create({
      data: {
        requestId: found.draft.id,
        kind: "PLEDGE",
        fileName: `${base}.${kind.ext}`,
        mimeType: kind.mime,
        size: buf.length,
        sha256: createHash("sha256").update(buf).digest("hex"),
        data: new Uint8Array(buf),
        uploadedById: user.id,
      },
    }),
  ]);
  revalidatePath(requestPath.content(found.draft.id));
  return { ok: true, message: t("req.ok.pledgeUploaded") };
}

export async function removePledgeAction(draftId: string, _prev: ActionState): Promise<ActionState> {
  const { found } = await loadContentDraft(draftId);
  const { t } = await getT();
  if (!found) return { error: t("req.err.notFoundOrSubmitted") };
  await db.requestAttachment.deleteMany({ where: { requestId: found.draft.id, kind: "PLEDGE" } });
  revalidatePath(requestPath.content(found.draft.id));
  return { ok: true, message: t("req.ok.pledgeRemoved") };
}

// -----------------------------------------------------------------------------
// التقديم
// -----------------------------------------------------------------------------

/** تقديم الطلب بعد إعادة التحقق من كل المراحل في الخادم. */
export async function submitRequestAction(draftId: string, _prev: ActionState): Promise<ActionState> {
  const { user, client } = await requireUser();
  const { t, locale } = await getT();
  const found = await getDraftWithSender(client.id, draftId);
  if (!found) {
    const any = await getOwnRequest(client.id, draftId);
    if (any?.status === "SUBMITTED") redirect(requestPath.submitted(any.id));
    return { error: t("req.err.notFound") };
  }

  const check = await checkDraftComplete(found.draft, found.sender);
  if (!check.ok) return { error: t("req.err.submitCheck", { message: t(check.message) }), values: { step: requestPath[check.step](found.draft.id) } };

  // التقديم يجعل الطلب «مستلم» ويُسجَّل ذلك في سجل الحالة، ثم يُرسل بريد الاستلام بعد الرد
  const changeId = await db.$transaction(async (tx) => {
    const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('template_request_ref_seq') AS n`;
    const now = new Date();
    const res = await tx.templateRequest.updateMany({
      where: { id: found.draft.id, clientId: client.id, status: "DRAFT" },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        referenceNo: Number(n),
        customerType: found.sender?.customerType ?? null,
        exceptions: check.evaluation.exceptions,
        userId: user.id,
        locale,
        reviewStatus: "RECEIVED",
      },
    });
    if (res.count !== 1) return null;
    const change = await tx.requestStatusChange.create({
      data: { requestId: found.draft.id, fromStatus: null, toStatus: "RECEIVED", createdAt: now },
      select: { id: true },
    });
    return change.id;
  });
  if (!changeId) return { error: t("req.err.submitFailed") };
  after(() => notifyStatusChange(changeId));
  redirect(requestPath.submitted(found.draft.id));
}

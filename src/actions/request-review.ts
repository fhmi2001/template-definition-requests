"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/http-meta";
import { NOTIFY_BATCH_MAX, applyStatusChange, notifyMany, notifyStatusChange } from "@/server/request-review";
import { getT } from "@/i18n/server";
import {
  AUTHORITY_REF_PATTERN,
  REJECTION_REASON_MAX,
  REJECTION_REASON_MIN,
  isReviewStatus,
  needsAuthorityRef,
  authorityRefRequired,
  REJECTED_DEFAULT_REF,
} from "@/lib/review-status";
import { uuidSchema } from "@/lib/validation";
import { buildWhere, parseFilters } from "@/server/admin-requests";
import type { Prisma } from "@/generated/prisma/client";
import type { ActionState } from "@/lib/action-state";

const detail = (id: string) => `/admin/requests/${id}`;

/**
 * تغيير حالة طلب مقدَّم. الرفض يتطلب سبباً يُحفظ في السجل ويُرسل للعميل.
 * «لدى الهيئة» و«مقبول» و«مرفوض» تتطلب رقم القالب (رقم الطلب لدى هيئة الاتصالات)، ويظهر للعميل وفي رسائل الحالة.
 * الحالة الحالية تُرسل مع النموذج حتى لا يُكتب فوق تغيير أجراه مشرف آخر للتو.
 */
export async function changeRequestStatusAction(requestId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const id = uuidSchema.safeParse(requestId);
  if (!id.success) return { error: t("rq.err.notFound") };

  const status = String(formData.get("status") ?? "");
  const current = String(formData.get("current") ?? "");
  const reason = String(formData.get("reason") ?? "").replace(/\r\n?/g, "\n").trim();
  const authorityRef = String(formData.get("authorityRef") ?? "").replace(/\s+/g, " ").trim();
  const values = { status, reason, authorityRef };

  if (!isReviewStatus(status)) return { fields: { status: t("rq.err.chooseStatus") }, values };
  if (status === "REJECTED") {
    if (!reason) return { fields: { reason: t("rq.err.reasonRequired") }, values };
    if (Array.from(reason).length < REJECTION_REASON_MIN) return { fields: { reason: t("rq.err.reasonShort") }, values };
    if (Array.from(reason).length > REJECTION_REASON_MAX) return { fields: { reason: t("rq.err.reasonLong") }, values };
  }
  if (authorityRefRequired(status) && !authorityRef) return { fields: { authorityRef: t("rq.err.authorityRequired") }, values };
  if (needsAuthorityRef(status) && authorityRef && !AUTHORITY_REF_PATTERN.test(authorityRef)) {
    return { fields: { authorityRef: t("rq.err.authorityInvalid") }, values };
  }
  if (status === current) return { error: t("rq.err.sameStatus"), tone: "info", values };

  const request = await db.templateRequest.findFirst({
    where: { id: id.data, status: "SUBMITTED" },
    select: { id: true, reviewStatus: true, referenceNo: true },
  });
  if (!request) return { error: t("rq.err.notFound") };
  if ((request.reviewStatus ?? "") !== current) return { error: t("rq.err.changed"), tone: "warning", values };

  const silent = formData.get("silent") === "on";
  const changeId = await applyStatusChange({
    adminId: admin.id,
    ip: (await requestMeta()).ip,
    request,
    status,
    reason,
    authorityRef: needsAuthorityRef(status) ? authorityRef || REJECTED_DEFAULT_REF : null,
    silent,
  });
  if (!changeId) return { error: t("rq.err.changed"), tone: "warning", values };
  if (!silent) after(() => notifyStatusChange(changeId));
  revalidatePath(detail(request.id));
  revalidatePath("/admin/requests");
  return { ok: true, message: t(silent ? "rq.ok.changedSilent" : "rq.ok.changed", { status: t(`rv.${status}`) }) };
}

/** إعادة إرسال بريد إشعار لم يصل (فشل أو لم تكن خدمة البريد مهيأة). */
export async function resendStatusEmailAction(changeId: string, _prev: ActionState): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const id = uuidSchema.safeParse(changeId);
  const change = id.success
    ? await db.requestStatusChange.findUnique({ where: { id: id.data }, select: { id: true, requestId: true } })
    : null;
  if (!change) return { error: t("rq.err.notFound") };

  await db.requestStatusChange.update({ where: { id: change.id }, data: { emailStatus: null, emailError: null } });
  await audit({ adminId: admin.id, action: "request.email_resend", entityType: "template_request", entityId: change.requestId });
  after(() => notifyStatusChange(change.id));
  revalidatePath(detail(change.requestId));
  return { ok: true, message: t("rq.ok.resent") };
}

/** أقصى عدد طلبات في عملية جماعية واحدة. */
const BULK_MAX = 100;

/**
 * تغيير حالة عدة طلبات دفعة واحدة: المحدَّد بالنقر (ids) أو كل نتائج البحث الحالية (scope=all مع الفلاتر).
 * رقم القالب لا يُدخل هنا: الطلب الذي لا رقم محفوظ له يُتخطّى عند «لدى الهيئة/مقبول/مرفوض»، والسبب مشترك للرفض.
 * الإشعارات تُرسل بالتتابع، لذا تُحدَّد بـ NOTIFY_BATCH_MAX ما لم يُختر «بدون إشعار».
 */
export async function bulkChangeStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").replace(/\r\n?/g, "\n").trim();
  const silent = formData.get("silent") === "on";
  const values = { status, reason };

  if (!isReviewStatus(status)) return { fields: { status: t("rq.err.chooseStatus") }, values };
  if (status === "REJECTED") {
    if (!reason) return { fields: { reason: t("rq.err.reasonRequired") }, values };
    if (Array.from(reason).length < REJECTION_REASON_MIN) return { fields: { reason: t("rq.err.reasonShort") }, values };
    if (Array.from(reason).length > REJECTION_REASON_MAX) return { fields: { reason: t("rq.err.reasonLong") }, values };
  }

  let where: Prisma.TemplateRequestWhereInput;
  if (formData.get("scope") === "all") {
    where = buildWhere(parseFilters(Object.fromEntries(new URLSearchParams(String(formData.get("filters") ?? "")))));
  } else {
    const ids = [...new Set(formData.getAll("ids").map(String))].filter((v) => uuidSchema.safeParse(v).success);
    if (ids.length === 0) return { error: t("rq.bulk.err.none"), values };
    if (ids.length > BULK_MAX) return { error: t("rq.bulk.err.tooMany", { max: BULK_MAX }), values };
    where = { id: { in: ids }, status: "SUBMITTED" };
  }

  const targets = await db.templateRequest.findMany({
    where,
    take: BULK_MAX + 1,
    orderBy: [{ submittedAt: "asc" }, { referenceNo: "asc" }],
    select: { id: true, reviewStatus: true, referenceNo: true, authorityRef: true },
  });
  if (targets.length > BULK_MAX) return { error: t("rq.bulk.err.tooMany", { max: BULK_MAX }), values };

  const same = targets.filter((r) => r.reviewStatus === status);
  const noRef = targets.filter((r) => r.reviewStatus !== status && authorityRefRequired(status) && !r.authorityRef);
  const eligible = targets.filter((r) => r.reviewStatus !== status && !(authorityRefRequired(status) && !r.authorityRef));
  if (eligible.length === 0) return { error: t("rq.bulk.err.nothing", { same: same.length, noRef: noRef.length }), tone: "info", values };
  if (!silent && eligible.length > NOTIFY_BATCH_MAX) {
    return { error: t("rq.bulk.err.notifyCap", { max: NOTIFY_BATCH_MAX, count: eligible.length }), tone: "warning", values };
  }

  const ip = (await requestMeta()).ip;
  const changedIds: string[] = [];
  let conflicts = 0;
  for (const r of eligible) {
    const changeId = await applyStatusChange({
      adminId: admin.id,
      ip,
      request: r,
      status,
      reason,
      authorityRef: r.authorityRef ?? (status === "REJECTED" ? REJECTED_DEFAULT_REF : null),
      silent,
      bulk: true,
    });
    if (changeId) changedIds.push(changeId);
    else conflicts++;
  }
  if (!silent && changedIds.length > 0) after(() => notifyMany(changedIds));
  revalidatePath("/admin/requests");

  const parts = [t(silent ? "rq.bulk.okSilent" : "rq.bulk.ok", { n: changedIds.length, status: t(`rv.${status}`) })];
  if (same.length) parts.push(t("rq.bulk.skipSame", { n: same.length }));
  if (noRef.length) parts.push(t("rq.bulk.skipNoRef", { n: noRef.length }));
  if (conflicts) parts.push(t("rq.bulk.skipConflict", { n: conflicts }));
  return { ok: true, message: parts.join(" · ") };
}

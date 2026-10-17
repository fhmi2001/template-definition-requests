"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/request";
import { notifyStatusChange } from "@/server/request-review";
import { getT } from "@/i18n/server";
import { REJECTION_REASON_MAX, REJECTION_REASON_MIN, isReviewStatus } from "@/lib/review-status";
import { uuidSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

const detail = (id: string) => `/admin/requests/${id}`;

/**
 * تغيير حالة طلب مقدَّم. الرفض يتطلب سبباً يُحفظ في السجل ويُرسل للعميل.
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
  const values = { status, reason };

  if (!isReviewStatus(status)) return { fields: { status: t("rq.err.chooseStatus") }, values };
  if (status === "REJECTED") {
    if (!reason) return { fields: { reason: t("rq.err.reasonRequired") }, values };
    if (Array.from(reason).length < REJECTION_REASON_MIN) return { fields: { reason: t("rq.err.reasonShort") }, values };
    if (Array.from(reason).length > REJECTION_REASON_MAX) return { fields: { reason: t("rq.err.reasonLong") }, values };
  }
  if (status === current) return { error: t("rq.err.sameStatus"), tone: "info", values };

  const request = await db.templateRequest.findFirst({
    where: { id: id.data, status: "SUBMITTED" },
    select: { id: true, reviewStatus: true, referenceNo: true },
  });
  if (!request) return { error: t("rq.err.notFound") };
  if ((request.reviewStatus ?? "") !== current) return { error: t("rq.err.changed"), tone: "warning", values };

  const now = new Date();
  const changeId = await db.$transaction(async (tx) => {
    const res = await tx.templateRequest.updateMany({
      where: { id: request.id, status: "SUBMITTED", reviewStatus: request.reviewStatus },
      data: { reviewStatus: status, rejectionReason: status === "REJECTED" ? reason : null, reviewedAt: now },
    });
    if (res.count !== 1) return null;
    const change = await tx.requestStatusChange.create({
      data: {
        requestId: request.id,
        fromStatus: request.reviewStatus,
        toStatus: status,
        reason: status === "REJECTED" ? reason : null,
        adminId: admin.id,
        createdAt: now,
      },
      select: { id: true },
    });
    return change.id;
  });
  if (!changeId) return { error: t("rq.err.changed"), tone: "warning", values };

  await audit({
    adminId: admin.id,
    action: "request.status_change",
    entityType: "template_request",
    entityId: request.id,
    metadata: { referenceNo: request.referenceNo, from: request.reviewStatus, to: status, ...(status === "REJECTED" ? { reason } : {}) },
    ip: (await requestMeta()).ip,
  });
  after(() => notifyStatusChange(changeId));
  revalidatePath(detail(request.id));
  revalidatePath("/admin/requests");
  return { ok: true, message: t("rq.ok.changed", { status: t(`rv.${status}`) }) };
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

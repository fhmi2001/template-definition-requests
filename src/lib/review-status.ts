import type { ReviewStatus } from "@/generated/prisma/enums";

/** حالات الطلب المقدَّم بالترتيب الذي تُعرض به. */
export const REVIEW_STATUSES = ["RECEIVED", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const satisfies readonly ReviewStatus[];
export const isReviewStatus = (v: unknown): v is ReviewStatus => REVIEW_STATUSES.includes(v as ReviewStatus);

/** ألوان شارة الحالة في الواجهة. */
export const REVIEW_STYLE: Record<ReviewStatus, string> = {
  RECEIVED: "bg-[#e3eef9] text-[#1d4f86]",
  UNDER_REVIEW: "bg-warn-50 text-warn-700",
  APPROVED: "bg-brand-50 text-brand-600",
  REJECTED: "bg-danger-50 text-danger-700",
};

export const REJECTION_REASON_MIN = 5;
export const REJECTION_REASON_MAX = 1000;

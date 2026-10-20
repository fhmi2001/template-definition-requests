import type { ReviewStatus } from "@/generated/prisma/enums";

/** حالات الطلب المقدَّم بالترتيب الذي تُعرض به. */
export const REVIEW_STATUSES = ["RECEIVED", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const satisfies readonly ReviewStatus[];
export const isReviewStatus = (v: unknown): v is ReviewStatus => REVIEW_STATUSES.includes(v as ReviewStatus);

/** ألوان شارة الحالة في الواجهة. */
export const REVIEW_STYLE: Record<ReviewStatus, string> = {
  RECEIVED: "bg-info-50 text-info-700",
  UNDER_REVIEW: "bg-warn-50 text-warn-700",
  APPROVED: "bg-brand-50 text-brand-700",
  REJECTED: "bg-danger-50 text-danger-700",
};

export const REJECTION_REASON_MIN = 5;
export const REJECTION_REASON_MAX = 1000;

/**
 * رقم القالب (رقم الطلب لدى هيئة الاتصالات): إلزامي عند نقل الطلب إلى «لدى الهيئة» أو «مقبول» أو «مرفوض»،
 * أي كل حالة بعد «مستلم». يظهر للعميل في المتابعة ورسائل البريد بجانب رقم الطلب TDR.
 */
export const AUTHORITY_REF_STATUSES = ["UNDER_REVIEW", "APPROVED", "REJECTED"] as const satisfies readonly ReviewStatus[];
export const needsAuthorityRef = (s: unknown): boolean => AUTHORITY_REF_STATUSES.includes(s as (typeof AUTHORITY_REF_STATUSES)[number]);
export const AUTHORITY_REF_MAX = 50;
/** أحرف وأرقام (لاتينية أو عربية) مع - _ / . # والمسافة، بين حرفين و50 حرفاً. */
export const AUTHORITY_REF_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\-_/.# ]{1,49}$/u;

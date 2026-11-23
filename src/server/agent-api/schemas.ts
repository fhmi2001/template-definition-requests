import { z } from "zod";
import { AUTHORITY_REF_PATTERN, REJECTION_REASON_MAX, REJECTION_REASON_MIN } from "@/lib/review-status";

export const RESULTS_MAX = 25;

/** رقم الطلب الظاهر: 462 أو "TDR-000462" أو "462". */
export const referenceNoSchema = z
  .union([z.number().int(), z.string().trim()])
  .transform((v, ctx) => {
    const n = typeof v === "number" ? v : Number(/^TDR-0*(\d{1,9})$/i.exec(v)?.[1] ?? /^\d{1,9}$/.exec(v)?.[0] ?? NaN);
    if (!Number.isInteger(n) || n < 1 || n > 999_999_999) {
      ctx.addIssue({ code: "custom", message: "invalid referenceNo" });
      return z.NEVER;
    }
    return n;
  });

const clean = (s: string) => s.replace(/\r\n?/g, "\n").trim();

export const resultItemSchema = z
  .object({
    referenceNo: referenceNoSchema,
    /** RECEIVED غير مسموح: الوكلاء ينقلون الطلب للأمام فقط. */
    status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
    /** رقم NTR لدى Mobily/الهيئة. إلزامي لغير المرفوض ما لم يكن محفوظاً في الطلب. */
    authorityRef: z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().regex(AUTHORITY_REF_PATTERN)).optional(),
    /** سبب الرفض كما هو من Mobily مع الترجمة. */
    reason: z.string().transform(clean).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.status === "REJECTED") {
      const len = Array.from(v.reason ?? "").length;
      if (len < REJECTION_REASON_MIN || len > REJECTION_REASON_MAX) {
        ctx.addIssue({ code: "custom", path: ["reason"], message: `reason must be ${REJECTION_REASON_MIN}-${REJECTION_REASON_MAX} chars` });
      }
    }
  });

export const resultsBodySchema = z
  .object({
    results: z.array(resultItemSchema).min(1).max(RESULTS_MAX),
    /** إرسال بريد للعميل (الافتراضي نعم). false = بدون إشعار (مثل Janalkhair). */
    notify: z.boolean().default(true),
  })
  .strict();

export type ResultItem = z.infer<typeof resultItemSchema>;

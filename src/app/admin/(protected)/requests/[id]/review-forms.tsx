"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { changeRequestStatusAction, resendStatusEmailAction } from "@/actions/request-review";
import { initialState } from "@/lib/action-state";
import { REJECTION_REASON_MAX, REVIEW_STATUSES, REVIEW_STYLE } from "@/lib/review-status";
import { Alert, SubmitButton, ConfirmButton } from "@/components/ui";
import { useT } from "@/i18n/client";

/** تغيير حالة الطلب: أربع حالات، وسبب إلزامي عند الرفض. */
export function StatusForm({ requestId, current }: { requestId: string; current: ReviewStatus | null }) {
  const [state, action] = useActionState(changeRequestStatusAction.bind(null, requestId), initialState);
  const [selected, setSelected] = useState<ReviewStatus | null>(null);
  const [reasonLength, setReasonLength] = useState(0);
  const t = useT();

  // بعد الحفظ تصبح الحالة الجديدة هي الحالية، فيُلغى الاختيار
  useEffect(() => {
    if (state.ok) {
      setSelected(null);
      setReasonLength(0);
    }
  }, [state]);

  const rejecting = selected === "REJECTED";
  const reasonError = state.fields?.reason;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {/* القيمة من الحالة: React يعيد ضبط أزرار الاختيار بعد كل رد، والحقل المخفي لا يتأثر */}
      <input type="hidden" name="status" value={selected ?? ""} />
      <input type="hidden" name="current" value={current ?? ""} />
      {state.error ? <Alert tone={state.tone ?? "error"}>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <fieldset className="flex flex-col gap-2" aria-describedby={state.fields?.status ? "status-error" : undefined}>
        <legend className="mb-1 text-[13px] font-semibold text-ink-2">{t("rq.d.newStatus")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {REVIEW_STATUSES.map((s) => {
            const isCurrent = s === current;
            const on = s === selected;
            return (
              <label
                key={s}
                className={`flex min-h-12 items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
                  isCurrent
                    ? "cursor-not-allowed border-dashed border-line bg-canvas text-muted"
                    : on
                      ? "cursor-pointer border-brand-600 bg-brand-50"
                      : "cursor-pointer border-line bg-white hover:border-field-strong"
                }`}
              >
                <input
                  type="radio"
                  name="statusChoice"
                  value={s}
                  checked={on}
                  disabled={isCurrent}
                  onChange={() => setSelected(s)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex size-4 flex-none items-center justify-center rounded-full border-2 ${on ? "border-brand-600" : "border-field-strong"}`}
                >
                  {on ? <span className="size-2 rounded-full bg-brand-600" /> : null}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={`self-start rounded-full px-2 py-0.5 text-[13px] font-semibold ${REVIEW_STYLE[s]}`}>{t(`rv.${s}`)}</span>
                  {isCurrent ? <span className="mt-0.5 text-[13px]">{t("rq.d.current")}</span> : null}
                </span>
              </label>
            );
          })}
        </div>
        {state.fields?.status ? (
          <p id="status-error" role="alert" className="text-[13px] text-danger-600">
            {state.fields.status}
          </p>
        ) : null}
      </fieldset>

      {rejecting ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-[13px] font-semibold text-ink-2">
            {t("rq.d.reason")} <span className="text-danger-600">*</span>
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={4}
            required
            maxLength={REJECTION_REASON_MAX}
            dir="auto"
            defaultValue={state.values?.reason ?? ""}
            onChange={(e) => setReasonLength(Array.from(e.target.value).length)}
            aria-invalid={!!reasonError}
            aria-describedby={reasonError ? "reason-error reason-hint" : "reason-hint"}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] leading-7 ${reasonError ? "border-danger-600" : "border-field"}`}
          />
          {reasonError ? (
            <p id="reason-error" role="alert" className="text-[13px] text-danger-600">
              {reasonError}
            </p>
          ) : null}
          <div className="flex items-start justify-between gap-3 text-[13px] text-muted">
            <span id="reason-hint">{t("rq.d.reasonHint")}</span>
            <span dir="ltr" className="flex-none font-mono">
              {reasonLength} / {REJECTION_REASON_MAX}
            </span>
          </div>
        </div>
      ) : null}

      <div>
        <ConfirmButton
          variant={rejecting ? "danger" : "primary"}
          pendingText={t("rq.d.saving")}
          disabled={!selected}
          message={selected ? t("rq.d.confirm", { status: t(`rv.${selected}`) }) : ""}
        >
          {t("rq.d.save")}
        </ConfirmButton>
      </div>
    </form>
  );
}

/** إعادة إرسال بريد إشعار لم يصل. */
export function ResendEmailButton({ changeId }: { changeId: string }) {
  const [state, action] = useActionState(resendStatusEmailAction.bind(null, changeId), initialState);
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-1">
      <SubmitButton variant="ghost" pendingText={t("rq.resending")} className="min-h-8 self-start px-2 text-[13px]">
        {t("rq.resend")}
      </SubmitButton>
      {state.error ? <span className="text-[13px] text-danger-600">{state.error}</span> : null}
      {state.ok && state.message ? <span className="text-[13px] text-brand-700">{state.message}</span> : null}
    </form>
  );
}

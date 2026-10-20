"use client";

import { useActionState, useState } from "react";
import { saveSenderTypeAction } from "@/actions/requests";
import { initialState, type ActionState } from "@/lib/action-state";
import { AWARENESS } from "@/lib/sender-types";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { StepFooter } from "@/components/step-footer";
import { useT } from "@/i18n/client";

type TypeOption = { value: string; label: string; sub: string | null; purpose: string; examples: string[]; rule: string };

/** اختيار نوع مرسل واحد؛ عند «توعوي · Awareness» يظهر حقل Client Name الإلزامي. */
export function TypeForm({
  draftId,
  options,
  initialType,
  defaultClientName,
  backHref,
  fromReview = false,
}: {
  draftId: string;
  options: TypeOption[];
  initialType?: string;
  defaultClientName: string;
  backHref: string;
  /** فُتحت من صفحة المراجعة: الحفظ يعيد إليها */
  fromReview?: boolean;
}) {
  const [state, action] = useActionState(saveSenderTypeAction.bind(null, draftId), initialState);
  const [type, setType] = useState<string | undefined>(initialType);
  const [clientName, setClientName] = useState(defaultClientName);
  const t = useT();
  // خطأ «اختر نوع المرسل» يختفي بمجرد الاختيار، ويعود مع أي رد جديد من الخادم
  const [seenState, setSeenState] = useState<ActionState | null>(null);
  const typeError = state !== seenState ? state.fields?.senderType : undefined;

  return (
    <form action={action} className="flex flex-col gap-7 rounded-2xl border border-line bg-white p-5 sm:p-8" noValidate>
      {/* القيمة المرسلة من الحالة: React يعيد ضبط أزرار الاختيار بعد كل رد خطأ، والحقل المخفي لا يتأثر */}
      <input type="hidden" name="senderType" value={type ?? ""} />
      {fromReview ? <input type="hidden" name="from" value="review" /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}

      {/*
        كل بطاقة: الاسم، ثم جملة واحدة عن الغرض، ثم أمثلة قصيرة كشارات، ثم قاعدة الإرسال الأهم في سطر أخير.
        البطاقة المختارة: خلفية خضراء وحدّ مزدوج وعلامة ✓ ممتلئة (لا تعتمد على لون الحدّ وحده).
      */}
      <fieldset className="flex flex-col gap-3" aria-describedby={typeError ? "sender-type-error" : undefined}>
        <legend className="sr-only">{t("type.legend")}</legend>
        {typeError ? (
          <p id="sender-type-error" role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-700">
            {typeError}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const on = type === o.value;
            const descId = `type-${o.value}-desc`;
            return (
              <label
                key={o.value}
                className={`group flex h-full cursor-pointer flex-col rounded-2xl border transition-[border-color,background-color,box-shadow] duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
                  on
                    ? "border-brand-600 bg-brand-50 shadow-[inset_0_0_0_1px_var(--color-brand-600)]"
                    : "border-line-strong bg-white hover:border-field-strong hover:bg-canvas-2"
                }`}
              >
                <input
                  type="radio"
                  name="senderTypeChoice"
                  value={o.value}
                  checked={on}
                  aria-describedby={descId}
                  onChange={() => {
                    setType(o.value);
                    setSeenState(state);
                  }}
                  className="sr-only"
                />
                <span className="flex items-start gap-3 px-5 pb-3 pt-4">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex size-6 flex-none items-center justify-center rounded-full border-2 transition-colors ${
                      on ? "border-brand-600 bg-brand-600 text-white" : "border-field-strong bg-white"
                    }`}
                  >
                    {on ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-base font-bold ${on ? "text-brand-800" : "text-ink"}`}>{o.label}</span>
                      {o.sub ? (
                        <span dir="ltr" className="text-[13px] text-muted">
                          {o.sub}
                        </span>
                      ) : null}
                    </span>
                    <span id={descId} className="text-[14px] leading-6 text-ink-2">
                      {o.purpose}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5 px-5 pb-4 ps-14">
                  {o.examples.map((ex, i) => (
                    <span
                      key={ex}
                      className={`rounded-md px-2 py-0.5 text-[13px] leading-6 ${on ? "bg-white text-ink-2 ring-1 ring-inset ring-brand-200" : "bg-chip text-ink-2"}`}
                    >
                      {ex}
                      {i < o.examples.length - 1 ? <span className="sr-only">{t("common.listSep")}</span> : null}
                    </span>
                  ))}
                </span>
                <span
                  className={`mt-auto flex items-center gap-2 border-t px-5 py-3 ps-14 text-[13px] leading-5 ${
                    on ? "border-brand-200 text-brand-800" : "border-hair text-muted"
                  }`}
                >
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  {o.rule}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {type === AWARENESS ? (
        <div className="max-w-[560px]">
          <Field
            id="awareness-client-name"
            label="Client Name"
            error={state.fields?.clientName}
            hint={t("type.clientNameHint")}
          >
            <input
              id="awareness-client-name"
              name="clientName"
              type="text"
              required
              maxLength={255}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              aria-invalid={!!state.fields?.clientName}
              className={inputClass(!!state.fields?.clientName)}
            />
          </Field>
        </div>
      ) : null}

      <StepFooter backHref={backHref} backLabel={fromReview ? t("review.back") : t("common.previous")}>
        <SubmitButton pendingText={t("common.saving")} className="min-w-32">
          {fromReview ? t("review.save") : t("common.next")}
        </SubmitButton>
      </StepFooter>
    </form>
  );
}

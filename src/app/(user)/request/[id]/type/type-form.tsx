"use client";

import { useActionState, useState } from "react";
import { saveSenderTypeAction } from "@/actions/requests";
import { initialState, type ActionState } from "@/lib/action-state";
import { AWARENESS } from "@/lib/sender-types";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { StepFooter } from "@/components/step-footer";
import { useT } from "@/i18n/client";

type TypeOption = { value: string; label: string; sub: string | null };

/** اختيار نوع مرسل واحد؛ عند «توعوي · Awareness» يظهر حقل Client Name الإلزامي. */
export function TypeForm({
  draftId,
  options,
  initialType,
  defaultClientName,
  backHref,
}: {
  draftId: string;
  options: TypeOption[];
  initialType?: string;
  defaultClientName: string;
  backHref: string;
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
      {state.error ? <Alert>{state.error}</Alert> : null}

      <fieldset className="flex flex-col gap-3" aria-describedby={typeError ? "sender-type-error" : undefined}>
        <legend className="mb-1 text-base font-bold">
          {t("type.legend")} <span className="text-[13px] font-normal text-muted">{t("type.legendHint")}</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => {
            const on = type === o.value;
            return (
              <label
                key={o.value}
                className={`flex min-h-[72px] cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-3 transition-[border-color,background-color,box-shadow] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-300 ${
                  on
                    ? "border-brand-600 bg-brand-25 shadow-[inset_0_0_0_1px_var(--color-brand-600)]"
                    : typeError
                      ? "border-danger-600 bg-white hover:border-danger-700"
                      : "border-line-strong bg-white hover:border-field-strong"
                }`}
              >
                <input
                  type="radio"
                  name="senderTypeChoice"
                  value={o.value}
                  checked={on}
                  onChange={() => {
                    setType(o.value);
                    setSeenState(state);
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex size-5 flex-none items-center justify-center rounded-full border-2 ${on ? "border-brand-600" : "border-field-strong"}`}
                >
                  {on ? <span className="size-2.5 rounded-full bg-brand-600" /> : null}
                </span>
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{o.label}</span>
                  {o.sub ? (
                    <span dir="ltr" className="text-[13px] text-muted">
                      {o.sub}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
        {typeError ? (
          <p id="sender-type-error" role="alert" className="text-[13px] text-danger-600">
            {typeError}
          </p>
        ) : null}
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

      <StepFooter backHref={backHref} backLabel={t("common.previous")}>
        <SubmitButton pendingText={t("common.saving")} className="min-w-32">
          {t("common.next")}
        </SubmitButton>
      </StepFooter>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveSenderTypeAction } from "@/actions/requests";
import { initialState, type ActionState } from "@/lib/action-state";
import { AWARENESS } from "@/lib/sender-types";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { backLinkClass, footerClass } from "../../request-classes";
import { useT } from "@/i18n/client";

export type TypeOption = { value: string; label: string; sub: string | null };

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
    <form action={action} className="flex flex-col gap-6 rounded-2xl border border-line bg-white p-5 sm:p-6" noValidate>
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
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#8cc4b3] ${
                  on ? "border-brand-600 bg-brand-50" : typeError ? "border-danger-600/50 bg-white hover:border-[#9aa59f]" : "border-line bg-white hover:border-[#9aa59f]"
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
                  className={`flex size-5 flex-none items-center justify-center rounded-full border-2 ${on ? "border-brand-600" : "border-[#8a9590]"}`}
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

      <div className={footerClass}>
        <Link href={backHref} className={backLinkClass}>
          {t("common.previous")}
        </Link>
        <SubmitButton pendingText={t("common.saving")} className="min-w-32">
          {t("common.next")}
        </SubmitButton>
      </div>
    </form>
  );
}

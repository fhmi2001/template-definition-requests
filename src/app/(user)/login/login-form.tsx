"use client";

import { useActionState } from "react";
import { requestOtpAction } from "@/actions/user-auth";
import { initialState } from "@/lib/action-state";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { useT } from "@/i18n/client";

export function LoginForm() {
  const [state, action] = useActionState(requestOtpAction, initialState);
  const t = useT();

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.error ? <Alert tone={state.tone ?? "error"}>{state.error}</Alert> : null}

      <Field id="email" label={t("login.email")} error={state.fields?.email}>
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          inputMode="email"
          placeholder="name@company.com"
          defaultValue={state.values?.email ?? ""}
          required
          aria-invalid={state.fields?.email ? true : undefined}
          aria-describedby={state.fields?.email ? "email-error" : undefined}
          className={`${inputClass(!!state.fields?.email)} text-left`}
        />
      </Field>

      <div className="flex flex-col gap-3.5">
        <SubmitButton pendingText={t("login.sending")} className="h-12 text-base">
          {t("login.send")}
        </SubmitButton>
        <p className="text-[13px] leading-6 text-muted">{t("login.hint")}</p>
      </div>
    </form>
  );
}

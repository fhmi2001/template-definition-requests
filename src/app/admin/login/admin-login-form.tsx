"use client";

import { useActionState, useState } from "react";
import { adminLoginAction } from "@/actions/admin-auth";
import { initialState } from "@/lib/action-state";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { useT } from "@/i18n/client";

export function AdminLoginForm() {
  const [state, action] = useActionState(adminLoginAction, initialState);
  const [showPw, setShowPw] = useState(false);
  const t = useT();

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert tone={state.tone ?? "error"}>{state.error}</Alert> : null}

      <Field id="username" label={t("adminLogin.username")} error={state.fields?.username}>
        <input
          id="username"
          name="username"
          type="text"
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.values?.username ?? ""}
          required
          className={`${inputClass(!!state.fields?.username)} text-left font-mono`}
        />
      </Field>

      <Field id="password" label={t("adminLogin.password")} error={state.fields?.password}>
        <div className="flex overflow-hidden rounded-xl border border-field bg-white focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand-300 focus-within:outline-solid">
          <input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            dir="ltr"
            autoComplete="current-password"
            required
            className="h-[46px] min-w-0 flex-1 px-3.5 text-left font-mono text-base outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? t("adminLogin.hidePw") : t("adminLogin.showPw")}
            aria-pressed={showPw}
            className="flex w-12 flex-none items-center justify-center border-s border-line bg-canvas text-ink-2"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </Field>

      <SubmitButton pendingText={t("adminLogin.checking")} className="h-12 text-base">
        {t("adminLogin.submit")}
      </SubmitButton>
    </form>
  );
}

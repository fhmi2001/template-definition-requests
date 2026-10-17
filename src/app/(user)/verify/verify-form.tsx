"use client";

import { useActionState, useEffect, useState } from "react";
import { resendOtpAction, verifyOtpAction } from "@/actions/user-auth";
import { initialState } from "@/lib/action-state";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { useT } from "@/i18n/client";

function secondsUntil(iso: string | null, now: number) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000));
}

export function VerifyForm({ expiresAt, resendAvailableAt }: { expiresAt: string | null; resendAvailableAt: string | null }) {
  const [state, verify] = useActionState(verifyOtpAction, initialState);
  const [resendState, resend] = useActionState(resendOtpAction, initialState);
  const [now, setNow] = useState(() => Date.now());
  const t = useT();
  const [code, setCode] = useState("");

  // آخر رسالة ظاهرة تخص آخر زر ضُغط (التحقق أو إعادة الإرسال)
  const [last, setLast] = useState<"verify" | "resend" | null>(null);
  useEffect(() => {
    if (state !== initialState) {
      setLast("verify");
      setCode(""); // بعد رمز خاطئ يُفرَّغ الحقل لإعادة الإدخال
    }
  }, [state]);

  // بعد إعادة الإرسال تبدأ المهلتان من جديد
  const [timers, setTimers] = useState({ expiresAt, resendAvailableAt });
  useEffect(() => {
    if (resendState !== initialState) setLast("resend");
    if (resendState.ok) {
      const t = Date.now();
      setTimers({
        expiresAt: new Date(t + 5 * 60 * 1000).toISOString(),
        resendAvailableAt: new Date(t + 60 * 1000).toISOString(),
      });
      setCode("");
    }
  }, [resendState]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = secondsUntil(timers.expiresAt, now);
  const cooldown = secondsUntil(timers.resendAvailableAt, now);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-6">
      {last === "verify" && state.error ? <Alert tone={state.tone ?? "error"}>{state.error}</Alert> : null}
      {last === "resend" && resendState.error ? <Alert tone={resendState.tone ?? "error"}>{resendState.error}</Alert> : null}
      {last === "resend" && resendState.message ? <Alert tone="success">{resendState.message}</Alert> : null}
      {left === 0 && !(last === "verify" && state.error) ? (
        <Alert tone="warning">{t("verify.expired")}</Alert>
      ) : null}

      <form action={verify} className="flex flex-col gap-6" noValidate>
        <Field
          id="code"
          label={
            <span className="flex w-full items-baseline justify-between gap-2">
              <span>{t("verify.codeLabel")}</span>
              <span className="text-[13px] font-normal text-muted">
                {t("verify.expiresIn")}{" "}
                <span dir="ltr" className="font-mono font-medium text-ink">
                  {mm}:{ss}
                </span>
              </span>
            </span>
          }
          error={state.fields?.code}
        >
          <input
            id="code"
            name="code"
            type="text"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus
            aria-invalid={state.fields?.code ? true : undefined}
            className={`${inputClass(!!state.fields?.code)} h-16 text-center font-mono text-[32px] tracking-[16px]`}
          />
        </Field>
        <SubmitButton pendingText={t("verify.checking")} className="h-12 text-base">
          {t("verify.submit")}
        </SubmitButton>
      </form>

      <form action={resend} className="flex min-h-11 items-center justify-center gap-1.5 text-sm text-muted">
        <span>{t("verify.notReceived")}</span>
        {cooldown > 0 ? (
          <span aria-live="off">{t("verify.resendIn", { n: cooldown })}</span>
        ) : (
          <SubmitButton variant="ghost" pendingText={t("login.sending")} className="min-h-11 px-2 text-sm text-brand-600 underline">
            {t("verify.resend")}
          </SubmitButton>
        )}
      </form>
    </div>
  );
}

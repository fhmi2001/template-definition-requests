"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/actions/locale";
import { useLocale, useT } from "@/i18n/client";

/** زر تبديل اللغة (عربي / English). */
export function LanguageSwitcher({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  const locale = useLocale();
  const t = useT();
  const [pending, start] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => start(() => setLocaleAction(next))}
      disabled={pending}
      lang={next}
      aria-label={t("lang.switchLabel")}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border px-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
        dark ? "border-[#3d5a51] text-[#cfe3db] hover:bg-night-2" : "border-field bg-white text-ink hover:bg-canvas"
      } ${className}`}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      {t("lang.switch")}
    </button>
  );
}

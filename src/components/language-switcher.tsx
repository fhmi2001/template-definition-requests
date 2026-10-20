"use client";

import { useTransition } from "react";
import { setLocaleAction } from "@/actions/locale";
import { useLocale, useT } from "@/i18n/client";

/** زر تبديل اللغة (عربي / English). compact: اختصار اللغة فقط. */
export function LanguageSwitcher({ dark = false, compact = false, className = "" }: { dark?: boolean; compact?: boolean; className?: string }) {
  const locale = useLocale();
  const t = useT();
  const [pending, start] = useTransition();
  const next = locale === "ar" ? "en" : "ar";
  const abbr = next === "en" ? "EN" : "ع";
  return (
    <button
      type="button"
      onClick={() => start(() => setLocaleAction(next))}
      disabled={pending}
      lang={next}
      // الاسم المسموع يبدأ بالنص الظاهر (EN / ع) لمستخدمي التحكم الصوتي (WCAG 2.5.3)
      aria-label={compact ? `${abbr} – ${t("lang.switchLabel")}` : t("lang.switchLabel")}
      className={`inline-flex min-h-11 items-center sm:min-h-10 gap-1.5 rounded-xl border px-3 text-small font-semibold transition-colors disabled:opacity-60 ${
        dark ? "border-night-line text-night-fg hover:bg-night-2" : "border-line-strong bg-white text-ink hover:bg-canvas"
      } ${className}`}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      {compact ? <span aria-hidden="true">{abbr}</span> : t("lang.switch")}
    </button>
  );
}

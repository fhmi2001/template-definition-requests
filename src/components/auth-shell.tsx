"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Logo({ subtitle, dark = false }: { subtitle?: string; dark?: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className={`flex size-10 flex-none items-center justify-center rounded-[10px] font-mono text-[13px] font-medium tracking-wide ${
          dark ? "bg-brand-50 text-[#0b3f33]" : "bg-brand-600 text-white"
        }`}
      >
        TDR
      </div>
      <div className="flex min-w-0 flex-col">
        <span className={`text-base font-semibold leading-snug ${dark ? "text-[#f1f5f3]" : ""}`}>{t("app.name")}</span>
        <span dir="auto" className={`text-xs [text-align:match-parent] ${dark ? "text-[#a9bdb5]" : "text-subtle"}`}>
          {subtitle ?? t("app.subtitle")}
        </span>
      </div>
    </div>
  );
}

/** إطار شاشات الدخول: شعار، بطاقة في المنتصف، وتذييل. */
export function AuthShell({
  children,
  footer,
  dark = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  dark?: boolean;
}) {
  const t = useT();
  return (
    <div className={`flex min-h-screen flex-col ${dark ? "bg-night" : "bg-canvas"}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-8">
        <Logo dark={dark} subtitle={dark ? t("admin.panel") : undefined} />
        <LanguageSwitcher dark={dark} />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-6">
        <div className={`w-full max-w-[440px] rounded-2xl bg-white px-6 py-10 sm:px-8 ${dark ? "" : "border border-line"}`}>
          {children}
        </div>
      </main>
      {footer ? (
        <footer
          className={`flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-[13px] sm:px-8 ${
            dark ? "text-[#cfe3db]" : "border-t border-line text-muted"
          }`}
        >
          {footer}
        </footer>
      ) : null}
    </div>
  );
}

export function FooterLink({ href, children, dark = false }: { href: string; children: ReactNode; dark?: boolean }) {
  return (
    <Link href={href} className={`font-semibold underline-offset-4 hover:underline ${dark ? "text-[#cfe3db]" : "text-brand-600"}`}>
      {children}
    </Link>
  );
}

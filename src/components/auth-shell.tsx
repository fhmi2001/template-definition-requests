"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { BrandLogo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MessageBubble, TokenChip } from "@/components/message-bubble";

/** نص المثال في لوحة التعريف: كل #VarN# يظهر كشارة. */
function SampleText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(#Var\d+#)/).map((part, i) => (/^#Var\d+#$/.test(part) ? <TokenChip key={i}>{part}</TokenChip> : part))}
    </>
  );
}

/** لوحة تعريف بالمنصة بجانب نموذج الدخول (على الشاشات الواسعة فقط). */
function IntroPanel() {
  const t = useT();
  const steps = [t("auth.panel.step1"), t("auth.panel.step2"), t("auth.panel.step3")];
  return (
    <aside className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-brand-25 px-12 py-10 lg:flex">
      <BrandLogo size="lg" product={t("app.name")} />

      <div className="flex max-w-[460px] flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-[32px] font-bold leading-[1.35] text-ink">{t("auth.panel.title")}</h2>
          <p className="text-base leading-8 text-muted">{t("auth.panel.lead")}</p>
        </div>

        <MessageBubble sender="Deewan" meta={t("auth.panel.sampleMeta")}>
          <SampleText text={t("auth.panel.sample")} />
        </MessageBubble>

        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-[15px] text-ink-2">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-white font-mono text-[13px] font-semibold text-brand-700 ring-1 ring-brand-200">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-[13px] text-subtle">{t("auth.panel.footer")}</p>
    </aside>
  );
}

/**
 * إطار شاشات الدخول.
 * - للعميل: لوحة تعريف + النموذج على الشاشات الواسعة، والنموذج وحده على الجوال.
 * - للإدارة (dark): بطاقة في منتصف خلفية داكنة.
 */
export function AuthShell({ children, footer, dark = false }: { children: ReactNode; footer?: ReactNode; dark?: boolean }) {
  const t = useT();

  if (dark) {
    return (
      <div className="flex min-h-screen flex-col bg-night">
        <header data-surface="dark" className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-8">
          <BrandLogo tone="dark" product={t("admin.panel")} />
          <LanguageSwitcher dark />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-6">
          <div className="w-full max-w-[440px] rounded-2xl bg-white px-6 py-10 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)] sm:px-8">{children}</div>
        </main>
        {footer ? <footer data-surface="dark" className="flex flex-wrap items-center justify-between gap-3 px-6 pb-24 pt-5 text-[13px] text-night-fg sm:px-8 sm:pb-5">{footer}</footer> : null}
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <IntroPanel />
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <span className="lg:invisible">
            <BrandLogo product={t("app.name")} />
          </span>
          <LanguageSwitcher />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
        {footer ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 pb-24 pt-5 text-[13px] text-muted sm:px-8 sm:pb-5">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

export function FooterLink({ href, children, dark = false }: { href: string; children: ReactNode; dark?: boolean }) {
  return (
    <Link href={href} className={`font-semibold underline-offset-4 hover:underline ${dark ? "text-night-fg" : "text-brand-700"}`}>
      {children}
    </Link>
  );
}

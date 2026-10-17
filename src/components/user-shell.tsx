import Link from "next/link";
import type { ReactNode } from "react";
import { logoutUserAction } from "@/actions/user-auth";
import { BrandLogo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";

type Section = "new" | "mine";

const NAV: { key: Section; href: string; label: MessageKey }[] = [
  { key: "new", href: "/home", label: "unav.new" },
  { key: "mine", href: "/requests", label: "unav.mine" },
];

/** قائمة الحساب: اسم العميل والبريد وتسجيل الخروج (تعمل بدون JavaScript). */
async function AccountMenu({ email, clientName }: { email: string; clientName: string }) {
  const { t } = await getT();
  return (
    <details className="group relative">
      <summary
        aria-label={t("unav.account")}
        className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-1.5 hover:bg-canvas [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-200">
          {clientName.trim().charAt(0)}
        </span>
        <span className="hidden max-w-[180px] truncate text-sm font-semibold md:block">{clientName}</span>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-muted transition-transform group-open:rotate-180">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="absolute end-0 top-full z-30 mt-2 flex w-72 flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.18)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{clientName}</span>
          <span dir="ltr" className="truncate text-[13px] text-muted">
            {email}
          </span>
        </div>
        <form action={logoutUserAction} className="border-t border-hair pt-3">
          <button type="submit" className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-semibold text-danger-700 hover:bg-danger-50">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
            </svg>
            {t("common.logout")}
          </button>
        </form>
      </div>
    </details>
  );
}

/** إطار صفحات العميل بعد الدخول: الشعار، التنقل، والحساب. */
export async function UserShell({
  email,
  clientName,
  section = "new",
  children,
}: {
  email: string;
  clientName: string;
  section?: Section;
  children: ReactNode;
}) {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <Link href="/home" className="rounded-lg">
            <BrandLogo product={t("app.name")} />
          </Link>
          <nav aria-label={t("unav.label")} className="order-last -mx-1 flex w-full gap-1 sm:order-none sm:w-auto">
            {NAV.map((n) => {
              const on = n.key === section;
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`relative inline-flex min-h-10 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors sm:flex-none ${
                    on ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  {t(n.label)}
                </Link>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher compact />
            <AccountMenu email={email} clientName={clientName} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

/** رأس الصفحة: عنوان ووصف قصير. */
export function PageHeader({ title, intro, children }: { title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-[720px] flex-col gap-2">
        <h1 className="text-[28px] font-bold leading-tight sm:text-[32px]">{title}</h1>
        {intro ? <p className="text-[15px] leading-7 text-muted">{intro}</p> : null}
      </div>
      {children}
    </div>
  );
}

const STEPS: MessageKey[] = ["steps.sender", "steps.type", "steps.template", "steps.content", "steps.review"];

/**
 * مؤشر مراحل الطلب: شريط تقدّم من خمسة أجزاء.
 * current يبدأ من 1. المراحل المكتملة روابط للرجوع إليها عند تمرير draftId.
 */
export async function RequestSteps({ current, draftId }: { current: number; draftId?: string }) {
  const { t } = await getT();
  const hrefs = draftId
    ? [`/home?draft=${draftId}`, `/request/${draftId}/type`, `/request/${draftId}/template`, `/request/${draftId}/content`, `/request/${draftId}/summary`]
    : [];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-semibold text-brand-700 sm:hidden">
        {t("steps.of", { n: Math.min(current, STEPS.length), total: STEPS.length })} · {t(STEPS[Math.min(current, STEPS.length) - 1])}
      </p>
      <ol aria-label={t("steps.label")} className="grid grid-cols-5 gap-1.5 sm:gap-3">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "next";
          const href = state === "done" ? hrefs[i] : undefined;
          const body = (
            <>
              <span
                aria-hidden="true"
                className={`h-1.5 w-full rounded-full ${state === "next" ? "bg-line" : state === "current" ? "bg-brand-400" : "bg-brand-600"}`}
              />
              <span className="hidden items-center gap-1.5 text-[13px] sm:flex">
                <span
                  className={`flex size-5 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${
                    state === "next" ? "bg-chip text-muted" : "bg-brand-600 text-white"
                  }`}
                >
                  {state === "done" ? (
                    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  ) : (
                    <span className="font-mono">{n}</span>
                  )}
                </span>
                <span className={state === "current" ? "font-semibold text-ink" : href ? "text-brand-700 group-hover:underline" : "text-muted"}>{t(label)}</span>
              </span>
              <span className="sr-only sm:hidden">{t(label)}</span>
              {state === "done" ? <span className="sr-only">{t("common.completedSr")}</span> : null}
            </>
          );
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined}>
              {href ? (
                <Link href={href} className="group flex min-h-11 sm:min-h-9 flex-col gap-2 underline-offset-4">
                  {body}
                </Link>
              ) : (
                <div className="flex flex-col gap-2">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

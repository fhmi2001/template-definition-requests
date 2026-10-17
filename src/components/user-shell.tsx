import Link from "next/link";
import type { ReactNode } from "react";
import { logoutUserAction } from "@/actions/user-auth";
import { Logo } from "@/components/auth-shell";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";

/** إطار صفحات العميل بعد الدخول: الشعار، اسم العميل وبريده، وتسجيل الخروج. */
export async function UserShell({ email, clientName, children }: { email: string; clientName: string; children: ReactNode }) {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-4 py-4 sm:px-8">
        <Logo />
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold">{clientName}</span>
            <span dir="ltr" className="text-[13px] text-muted">
              {email}
            </span>
          </div>
          <form action={logoutUserAction}>
            <button type="submit" className="min-h-10 rounded-[10px] border border-field bg-white px-3.5 text-sm font-semibold hover:bg-canvas">
              {t("common.logout")}
            </button>
          </form>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col gap-6 px-4 pb-16 pt-8 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}

const STEPS: MessageKey[] = ["steps.sender", "steps.type", "steps.template", "steps.content", "steps.review"];

/**
 * مؤشر مراحل الطلب. current يبدأ من 1، وأكبر من عدد المراحل يعني اكتمالها كلها.
 * المراحل المكتملة روابط للرجوع إليها عند تمرير draftId.
 */
export async function RequestSteps({ current, draftId }: { current: number; draftId?: string }) {
  const { t } = await getT();
  const hrefs = draftId
    ? [`/home?draft=${draftId}`, `/request/${draftId}/type`, `/request/${draftId}/template`, `/request/${draftId}/content`, `/request/${draftId}/summary`]
    : [];
  return (
    <ol aria-label={t("steps.label")} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "next";
        const href = state === "done" ? hrefs[i] : undefined;
        const body = (
          <>
            <span
              className={`flex size-7 flex-none items-center justify-center rounded-full font-mono text-[13px] font-semibold ${
                state === "next" ? "border border-[#c9cfc9] bg-white text-muted" : "bg-brand-600 text-white"
              }`}
            >
              {state === "done" ? (
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              ) : (
                n
              )}
            </span>
            <span className={state === "current" ? "font-semibold text-ink" : href ? "text-brand-600 underline-offset-4 group-hover:underline" : "text-muted"}>
              {t(label)}
              {state === "done" ? <span className="sr-only">{t("common.completedSr")}</span> : null}
            </span>
          </>
        );
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            {i > 0 ? <span aria-hidden="true" className="h-px w-5 bg-[#c9cfc9] sm:w-10" /> : null}
            {href ? (
              <Link href={href} className="group flex min-h-9 items-center gap-2">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}

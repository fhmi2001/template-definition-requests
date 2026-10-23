import { adminLogoutAction } from "@/actions/admin-auth";
import { BrandLogo } from "@/components/brand";
import { isSuperAdmin, requireAdmin } from "@/server/auth/dal";
import { AdminNav } from "./admin-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SkipLink } from "@/components/skip-link";
import { getT } from "@/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const { t } = await getT();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <SkipLink label={t("common.skipToContent")} />
      <aside
        data-surface="dark"
        className="z-20 flex flex-none flex-col gap-4 bg-night px-4 py-4 text-night-fg lg:sticky lg:top-0 lg:h-dvh lg:w-[256px] lg:gap-8 lg:overflow-y-auto lg:py-6"
      >
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:px-2">
          <BrandLogo tone="dark" />
          <span className="text-meta font-medium text-night-muted lg:border-s-2 lg:border-brand-400 lg:ps-2.5">{t("admin.panel")}</span>
        </div>

        <AdminNav superAdmin={isSuperAdmin(admin)} />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-night-line pt-4 lg:mt-auto lg:flex-col lg:items-stretch lg:gap-3 lg:px-2">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-full bg-brand-600 text-small font-bold text-white">
              {admin.username.charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-col">
              <span dir="ltr" className="truncate font-mono text-meta font-medium text-white">
                {admin.username}
              </span>
              <span className="text-meta text-night-muted">{admin.role === "SUPER_ADMIN" ? t("admin.superAdmin") : t("admin.admin")}</span>
            </div>
          </div>
          <div className="ms-auto flex items-center gap-2 lg:ms-0 lg:justify-between">
            <LanguageSwitcher dark compact />
            <form action={adminLogoutAction}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-meta font-semibold text-night-fg transition-colors hover:bg-night-2"
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
                  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
                </svg>
                {t("common.logout")}
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="admin-main min-w-0 flex-1 px-4 pb-24 pt-7 outline-none sm:px-8 sm:pb-14 lg:px-10 lg:pt-9">
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}

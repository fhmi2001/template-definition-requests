import { adminLogoutAction } from "@/actions/admin-auth";
import { BrandLogo } from "@/components/brand";
import { requireAdmin } from "@/server/auth/dal";
import { AdminNav } from "./admin-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const { t } = await getT();

  return (
    <div className="flex min-h-screen flex-wrap items-stretch">
      <aside className="flex flex-[1_1_220px] flex-col gap-7 bg-night px-4 py-6 text-night-fg md:max-w-[260px]">
        <div className="px-2">
          <BrandLogo tone="dark" />
          <span className="mt-2 block text-[13px] text-night-muted">{t("admin.panel")}</span>
        </div>
        <AdminNav />
        <div className="mt-auto flex flex-col gap-2 border-t border-night-line px-3 pt-3.5">
          <span dir="ltr" className="font-mono text-[13px] text-white">
            {admin.username}
          </span>
          <span className="text-[13px] text-night-muted">{admin.role === "SUPER_ADMIN" ? t("admin.superAdmin") : t("admin.admin")}</span>
          <form action={adminLogoutAction}>
            <button type="submit" className="min-h-10 text-[13px] font-semibold text-night-fg underline-offset-4 hover:underline">
              {t("common.logout")}
            </button>
          </form>
          <LanguageSwitcher dark className="self-start" />
        </div>
      </aside>
      <main className="min-w-0 flex-[999_1_560px] px-5 pb-12 pt-8 sm:px-10">{children}</main>
    </div>
  );
}

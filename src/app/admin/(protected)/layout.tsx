import { adminLogoutAction } from "@/actions/admin-auth";
import { Logo } from "@/components/auth-shell";
import { requireAdmin } from "@/server/auth/dal";
import { AdminNav } from "./admin-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getT } from "@/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const { t } = await getT();

  return (
    <div className="flex min-h-screen flex-wrap items-stretch">
      <aside className="flex flex-[1_1_220px] flex-col gap-7 bg-night px-4 py-6 text-[#e6eeea] md:max-w-[260px]">
        <div className="px-2">
          <Logo dark subtitle={t("admin.panel")} />
        </div>
        <AdminNav />
        <div className="mt-auto flex flex-col gap-2 border-t border-[#2a4a40] px-3 pt-3.5">
          <span dir="ltr" className="font-mono text-[13px] text-[#f1f5f3]">
            {admin.username}
          </span>
          <span className="text-xs text-[#a9bdb5]">{admin.role === "SUPER_ADMIN" ? t("admin.superAdmin") : t("admin.admin")}</span>
          <form action={adminLogoutAction}>
            <button type="submit" className="min-h-10 text-[13px] font-semibold text-[#cfe3db] underline-offset-4 hover:underline">
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

import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { AuthShell, FooterLink } from "@/components/auth-shell";
import { getAdminSession } from "@/server/auth/dal";
import { AdminLoginForm } from "./admin-login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("adminLogin.title") };
}

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin/clients");
  const { t } = await getT();

  return (
    <AuthShell dark footer={<FooterLink dark href="/login">{t("adminLogin.back")}</FooterLink>}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="self-start rounded-full bg-[#e9ece8] px-2.5 py-1 text-xs font-semibold text-[#3f4945]">{t("adminLogin.badge")}</span>
          <h1 className="text-[28px] font-bold leading-snug">{t("adminLogin.title")}</h1>
          <p className="text-[15px] leading-7 text-muted">{t("adminLogin.intro")}</p>
        </div>
        <AdminLoginForm />
        <p className="text-[13px] leading-6 text-muted">{t("adminLogin.noSignup")}</p>
      </div>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getUserSession } from "@/server/auth/dal";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("login.title") };
}

export default async function LoginPage() {
  if (await getUserSession()) redirect("/home");
  const { t } = await getT();

  return (
    <AuthShell
      footer={<span>{t("login.footerWarn")}</span>}
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold text-brand-600">{t("login.step1")}</span>
          <h1 className="text-[28px] font-bold leading-snug">{t("login.title")}</h1>
          <p className="text-[15px] leading-7 text-muted">{t("login.intro")}</p>
        </div>
        <LoginForm />
      </div>
    </AuthShell>
  );
}

import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { AuthShell, FooterLink } from "@/components/auth-shell";
import { db } from "@/server/db";
import { getPendingOtpEmail } from "@/server/auth/session";
import { getUserSession } from "@/server/auth/dal";
import { OTP_RESEND_COOLDOWN_SEC, maskEmail } from "@/server/auth/otp";
import { VerifyForm } from "./verify-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("verify.title") };
}

export default async function VerifyPage() {
  if (await getUserSession()) redirect("/home");
  const email = await getPendingOtpEmail();
  if (!email) redirect("/login");
  const { t } = await getT();

  const otp = await db.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, expiresAt: true },
  });

  return (
    <AuthShell
      footer={
        <>
          <span>{t("verify.footerWarn")}</span>
          <FooterLink href="/login">{t("verify.backLink")}</FooterLink>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="text-meta font-semibold text-brand-600">{t("verify.step2")}</span>
          <h1 className="text-page font-bold">{t("verify.heading")}</h1>
          <p className="text-body text-muted">
            {t("verify.sentTo")}{" "}
            <span dir="ltr" className="font-semibold text-ink">
              {maskEmail(email)}
            </span>{" "}
            ·{" "}
            <FooterLink href="/login">{t("verify.changeEmail")}</FooterLink>
          </p>
        </div>
        <VerifyForm
          expiresAt={otp?.expiresAt.toISOString() ?? null}
          resendAvailableAt={
            otp ? new Date(otp.createdAt.getTime() + OTP_RESEND_COOLDOWN_SEC * 1000).toISOString() : null
          }
        />
      </div>
    </AuthShell>
  );
}

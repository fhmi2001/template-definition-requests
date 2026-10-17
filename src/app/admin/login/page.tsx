import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { AuthShell, FooterLink } from "@/components/auth-shell";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getAdminSession } from "@/server/auth/dal";
import { getPendingAdmin } from "@/server/auth/session";
import { OTP_RESEND_COOLDOWN_SEC, adminOtpKey, maskEmail } from "@/server/auth/otp";
import { adminCancelOtpAction, adminResendAction, adminVerifyAction } from "@/actions/admin-auth";
import { VerifyForm } from "@/app/(user)/verify/verify-form";
import { AdminLoginForm } from "./admin-login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("adminLogin.title"), robots: { index: false, follow: false } };
}

/**
 * دخول الأدمن على خطوتين: كلمة المرور، ثم رمز يصل إلى بريد الإدارة.
 * تُعرض هذه الصفحة من الرابط السري (ADMIN_LOGIN_PATH) عبر proxy.ts.
 */
export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin/clients");
  const { t } = await getT();
  const pendingId = await getPendingAdmin();

  if (pendingId) {
    const otp = await db.otpCode.findFirst({
      where: { email: adminOtpKey(pendingId), consumedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, expiresAt: true },
    });
    const to = env().ADMIN_OTP_EMAIL;

    return (
      <AuthShell
        dark
        footer={
          <form action={adminCancelOtpAction}>
            <button type="submit" className="min-h-10 font-semibold text-night-fg underline-offset-4 hover:underline">
              {t("adminCode.cancel")}
            </button>
          </form>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <span className="self-start rounded-full bg-chip px-2.5 py-1 text-[13px] font-semibold text-ink-2">{t("adminCode.badge")}</span>
            <h1 className="text-[28px] font-bold leading-snug">{t("adminCode.heading")}</h1>
            <p className="text-[15px] leading-7 text-muted">
              {t("adminCode.intro")}{" "}
              {to ? (
                <span dir="ltr" className="font-semibold text-ink">
                  {maskEmail(to)}
                </span>
              ) : null}
            </p>
          </div>
          <VerifyForm
            verifyAction={adminVerifyAction}
            resendAction={adminResendAction}
            expiresAt={otp?.expiresAt.toISOString() ?? null}
            resendAvailableAt={otp ? new Date(otp.createdAt.getTime() + OTP_RESEND_COOLDOWN_SEC * 1000).toISOString() : null}
          />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell dark footer={<FooterLink dark href="/login">{t("adminLogin.back")}</FooterLink>}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="self-start rounded-full bg-chip px-2.5 py-1 text-[13px] font-semibold text-ink-2">{t("adminLogin.badge")}</span>
          <h1 className="text-[28px] font-bold leading-snug">{t("adminLogin.title")}</h1>
          <p className="text-[15px] leading-7 text-muted">{t("adminLogin.intro")}</p>
        </div>
        <AdminLoginForm />
        <p className="text-[13px] leading-6 text-muted">{t("adminLogin.noSignup")}</p>
      </div>
    </AuthShell>
  );
}

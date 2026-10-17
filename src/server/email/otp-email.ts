import "server-only";
import { env } from "@/server/env";
import type { Locale } from "@/i18n/config";
import { makeT } from "@/i18n/translate";
import { escapeHtml, sendEmail } from "./send";
import { MAIL, emailLayout } from "./layout";

export class EmailSendError extends Error {}

function renderOtpEmail(code: string, locale: Locale) {
  const t = makeT(locale);
  const html = emailLayout(
    locale,
    `      <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(t("email.otp.heading"))}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:${MAIL.muted}">${escapeHtml(t("email.otp.body"))}</p>
      <div dir="ltr" style="text-align:center;padding:18px 0;border-radius:12px;background:${MAIL.brandSoft};color:${MAIL.brandDeep};font-family:Consolas,monospace;font-size:34px;letter-spacing:12px">${escapeHtml(code)}</div>
      <p style="margin:20px 0 0;font-size:14px;line-height:1.8;color:${MAIL.muted}">${escapeHtml(t("email.otp.ignore"))}</p>`,
    520,
  );
  return { html, text: t("email.otp.text", { code }), subject: t("email.otp.subject") };
}

/**
 * يرسل رمز التحقق.
 * في وضع التطوير يُطبع الرمز في نافذة الطرفية أيضاً، ولا يتوقف الدخول إذا رفض Resend الإرسال
 * (مثلاً قبل توثيق الدومين لا يرسل Resend إلا لبريد صاحب الحساب).
 */
export async function sendOtpEmail(to: string, code: string, locale: Locale) {
  const dev = env().NODE_ENV !== "production";
  if (dev) console.info(`\n[تطوير] رمز التحقق لـ ${to}: ${code}\n`);

  const result = await sendEmail({ to, ...renderOtpEmail(code, locale) });
  if (result.status !== "FAILED") return; // SKIPPED = التطوير بدون مفتاح: الرمز في الطرفية فقط
  if (dev) {
    console.warn(`[تطوير] رفض Resend الإرسال إلى ${to}: ${result.error} — استخدم الرمز المطبوع أعلاه.`);
    return;
  }
  throw new EmailSendError(result.error);
}

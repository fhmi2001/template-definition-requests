import "server-only";
import { Resend } from "resend";
import { env } from "@/server/env";
import { dirOf, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/translate";

export class EmailSendError extends Error {}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderOtpEmail(code: string, locale: Locale) {
  const t = makeT(locale);
  const safe = escapeHtml(code);
  const html = `<!doctype html>
<html lang="${locale}" dir="${dirOf(locale)}">
<body style="margin:0;padding:24px;background:#f4f5f2;font-family:Tahoma,Arial,sans-serif;color:#16201c">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dde1dc;border-radius:12px;padding:32px">
    <p style="margin:0 0 16px;font-size:15px;font-weight:bold">${escapeHtml(t("app.name"))}</p>
    <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(t("email.otp.heading"))}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:#4a5551">${escapeHtml(t("email.otp.body"))}</p>
    <div dir="ltr" style="text-align:center;padding:18px 0;border-radius:10px;background:#e3efea;color:#0b3f33;font-family:Consolas,monospace;font-size:34px;letter-spacing:12px">${safe}</div>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.8;color:#4a5551">${escapeHtml(t("email.otp.ignore"))}</p>
  </div>
</body>
</html>`;
  const text = t("email.otp.text", { code });
  return { html, text, subject: t("email.otp.subject") };
}

/**
 * يرسل رمز التحقق عبر Resend.
 * في وضع التطوير يُطبع الرمز في نافذة الطرفية أيضاً، ولا يتوقف الدخول إذا رفض Resend الإرسال
 * (مثلاً قبل توثيق الدومين لا يرسل Resend إلا لبريد صاحب الحساب).
 */
export async function sendOtpEmail(to: string, code: string, locale: Locale) {
  const { RESEND_API_KEY, EMAIL_FROM, NODE_ENV } = env();
  const dev = NODE_ENV !== "production";

  if (dev) console.info(`\n[تطوير] رمز التحقق لـ ${to}: ${code}\n`);
  if (!RESEND_API_KEY) return; // التطوير بدون مفتاح: الرمز في الطرفية فقط

  const { html, text, subject } = renderOtpEmail(code, locale);
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    if (dev) {
      console.warn(`[تطوير] رفض Resend الإرسال إلى ${to}: ${error.message} — استخدم الرمز المطبوع أعلاه.`);
      return;
    }
    throw new EmailSendError(error.message);
  }
}

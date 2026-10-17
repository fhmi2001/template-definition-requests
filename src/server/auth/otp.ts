import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

export const OTP_TTL_SEC = 5 * 60; // صلاحية الرمز
export const OTP_MAX_ATTEMPTS = 5; // محاولات الإدخال الخاطئة قبل إلغاء الرمز
export const OTP_RESEND_COOLDOWN_SEC = 60; // المدة قبل السماح بطلب رمز جديد

/** رمز عشوائي آمن من 6 أرقام. */
export function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** مفتاح رموز الأدمن في جدول otp_codes (بدل البريد) حتى لا تختلط برموز العملاء. */
export const adminOtpKey = (adminId: string) => `admin:${adminId}`;

/** لا نخزّن الرمز نفسه؛ نخزّن HMAC مربوطاً بالبريد. */
export function hashOtp(email: string, code: string) {
  return createHmac("sha256", env().OTP_SECRET).update(`${email}:${code}`).digest("hex");
}

export function otpMatches(storedHash: string, email: string, code: string) {
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashOtp(email, code), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** يخفي جزءاً من البريد للعرض: na***@company.com */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

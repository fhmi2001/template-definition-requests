"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requestMeta } from "@/server/http-meta";
import { hitRateLimit, waitText } from "@/server/auth/rate-limit";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SEC,
  OTP_TTL_SEC,
  generateOtpCode,
  hashOtp,
  otpMatches,
} from "@/server/auth/otp";
import {
  clearPendingOtpEmail,
  createUserSession,
  destroySession,
  getPendingOtpEmail,
  setPendingOtpEmail,
} from "@/server/auth/session";
import { EmailSendError, sendOtpEmail } from "@/server/email/otp-email";
import { emailSchema, otpCodeSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
import { getT } from "@/i18n/server";
import { getUserSession } from "@/server/auth/dal";
import { purgeAbandonedDrafts } from "@/server/requests";

type IssueResult = { ok: true } | { ok: false; state: ActionState };

/** يتحقق من التسجيل وحد المحاولات، ثم يولّد الرمز ويرسله. */
async function issueOtp(email: string, opts: { reuseRecent: boolean }): Promise<IssueResult> {
  const { ip } = await requestMeta();
  const { t, locale } = await getT();

  const byIp = await hitRateLimit(`otp:ip:${ip}`, 20, 15 * 60);
  if (!byIp.allowed) {
    return { ok: false, state: { error: t("auth.tooManyDevice", { wait: waitText(byIp.retryAfterSec, t) }), tone: "warning" } };
  }

  // البريد غير المسجّل لا يُرسل له شيء
  const user = await db.user.findUnique({ where: { email }, include: { client: true } });
  if (!user || !user.isActive || !user.client.isActive) {
    return { ok: false, state: { error: t("auth.notRegistered"), tone: "warning", values: { email } } };
  }

  const byEmail = await hitRateLimit(`otp:email:${email}`, 5, 15 * 60);
  if (!byEmail.allowed) {
    return { ok: false, state: { error: t("auth.tooManyEmail", { wait: waitText(byEmail.retryAfterSec, t) }), tone: "warning", values: { email } } };
  }

  // رمز أُرسل قبل أقل من دقيقة: لا نرسل غيره
  const latest = await db.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (latest && latest.expiresAt > new Date()) {
    const ageSec = (Date.now() - latest.createdAt.getTime()) / 1000;
    if (ageSec < OTP_RESEND_COOLDOWN_SEC) {
      if (opts.reuseRecent) return { ok: true }; // نفس الرمز ما زال صالحاً، ننتقل لشاشة الإدخال
      const wait = Math.ceil(OTP_RESEND_COOLDOWN_SEC - ageSec);
      return { ok: false, state: { error: t("auth.waitBeforeNew", { wait: waitText(wait, t) }), tone: "info" } };
    }
  }

  const code = generateOtpCode();
  const now = new Date();
  const [, otp] = await db.$transaction([
    // أي رمز سابق لم يُستخدم يُلغى
    db.otpCode.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: now } }),
    db.otpCode.create({
      data: {
        email,
        codeHash: hashOtp(email, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_SEC * 1000),
        requestIp: ip,
      },
    }),
  ]);

  try {
    await sendOtpEmail(email, code, locale);
  } catch (err) {
    await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    console.error("[otp] فشل إرسال البريد", err instanceof EmailSendError ? err.message : err);
    return { ok: false, state: { error: t("auth.sendFailed"), values: { email } } };
  }
  return { ok: true };
}

/** شاشة البريد: يتحقق أن البريد مسجّل ثم يرسل الرمز. */
export async function requestOtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    const { t } = await getT();
    return { fields: { email: t.x(parsed.error.issues[0].message) }, values: { email: raw } };
  }
  const email = parsed.data;

  const result = await issueOtp(email, { reuseRecent: true });
  if (!result.ok) return result.state;

  await setPendingOtpEmail(email);
  redirect("/verify");
}

/** زر "إعادة الإرسال" في شاشة الرمز. */
export async function resendOtpAction(_prev: ActionState): Promise<ActionState> {
  const email = await getPendingOtpEmail();
  if (!email) redirect("/login");

  const result = await issueOtp(email, { reuseRecent: false });
  if (!result.ok) return result.state;
  const { t } = await getT();
  return { ok: true, message: t("auth.resent") };
}

/** شاشة الرمز: يتحقق من الرمز وينشئ الجلسة. */
export async function verifyOtpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = await getPendingOtpEmail();
  if (!email) redirect("/login");

  const { t } = await getT();
  const parsed = otpCodeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) return { fields: { code: t.x(parsed.error.issues[0].message) } };
  const code = parsed.data;

  const meta = await requestMeta();
  const byIp = await hitRateLimit(`verify:ip:${meta.ip}`, 30, 15 * 60);
  if (!byIp.allowed) {
    return { error: t("auth.tooMany", { wait: waitText(byIp.retryAfterSec, t) }), tone: "warning" };
  }

  const otp = await db.otpCode.findFirst({
    where: { email, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt <= new Date()) {
    return { error: t("auth.codeExpired"), tone: "warning" };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return { error: t("auth.attemptsExhausted"), tone: "warning" };
  }

  if (!otpMatches(otp.codeHash, email, code)) {
    const updated = await db.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    const left = OTP_MAX_ATTEMPTS - updated.attempts;
    if (left <= 0) {
      await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      return { error: t("auth.wrongNoAttempts"), tone: "error" };
    }
    return { error: t("auth.wrongCode", { n: left }), tone: "error" };
  }

  // استهلاك الرمز مرة واحدة فقط حتى لو وصل طلبان في نفس اللحظة
  const consumed = await db.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) {
    return { error: t("auth.codeExpired"), tone: "warning" };
  }

  // قد يكون الأدمن عطّل البريد أو العميل بعد إرسال الرمز
  const user = await db.user.findUnique({ where: { email }, include: { client: true } });
  if (!user || !user.isActive || !user.client.isActive) {
    await clearPendingOtpEmail();
    return { error: t("auth.notRegistered"), tone: "warning" };
  }

  await createUserSession(user.id, meta);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  // كل دخول يبدأ من جديد: الطلبات غير المكتملة من زيارة سابقة تُحذف
  await purgeAbandonedDrafts(user.id);
  await clearPendingOtpEmail();
  redirect("/home");
}

export async function logoutUserAction() {
  const s = await getUserSession();
  if (s) await purgeAbandonedDrafts(s.user.id);
  await destroySession("USER");
  redirect("/login");
}

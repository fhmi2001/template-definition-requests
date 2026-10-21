"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requestMeta } from "@/server/http-meta";
import { audit } from "@/server/audit";
import { verifyPassword } from "@/server/auth/password";
import { hitRateLimit, waitText } from "@/server/auth/rate-limit";
import {
  OTP_RESEND_COOLDOWN_SEC,
  OTP_TTL_SEC,
  adminOtpKey,
  adminOtpRecipient,
  generateOtpCode,
  hashOtp,
  otpMatches,
  reserveOtpAttempt,
} from "@/server/auth/otp";
import { clearPendingAdmin, createAdminSession, destroySession, getPendingAdmin, setPendingAdmin } from "@/server/auth/session";
import { getAdminSession } from "@/server/auth/dal";
import { EmailSendError, sendOtpEmail } from "@/server/email/otp-email";
import { adminLoginSchema, fieldErrors, otpCodeSchema } from "@/lib/validation";
import { adminLoginPath } from "@/lib/admin-path";
import type { ActionState } from "@/lib/action-state";
import { getT } from "@/i18n/server";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

type IssueResult = { ok: true } | { ok: false; state: ActionState };

/**
 * يرسل رمز دخول الأدمن إلى بريده الخاص المسجّل في حسابه، ولا يوجد بريد بديل.
 * حساب بلا بريد يُمنع من الدخول هنا (قبل إنشاء أي رمز أو جلسة).
 * الرمز مخزّن في otp_codes بمفتاح admin:<id> حتى لا يختلط برموز العملاء، فلا يصلح إلا لهذا الحساب.
 */
async function issueAdminOtp(adminId: string, opts: { reuseRecent: boolean }): Promise<IssueResult> {
  const { t, locale } = await getT();
  const to = await adminOtpRecipient(adminId);
  if (!to) {
    const { ip } = await requestMeta();
    await audit({ adminId, action: "admin.login_blocked_no_email", entityType: "admin", entityId: adminId, ip });
    return { ok: false, state: { error: t("adminLogin.noEmail"), tone: "warning" } };
  }

  const { ip } = await requestMeta();
  const key = adminOtpKey(adminId);
  const byAdmin = await hitRateLimit(`admin-otp:${adminId}`, 5, 15 * 60);
  if (!byAdmin.allowed) {
    return { ok: false, state: { error: t("auth.tooManyEmail", { wait: waitText(byAdmin.retryAfterSec, t) }), tone: "warning" } };
  }

  const latest = await db.otpCode.findFirst({ where: { email: key, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (latest && latest.expiresAt > new Date()) {
    const ageSec = (Date.now() - latest.createdAt.getTime()) / 1000;
    if (ageSec < OTP_RESEND_COOLDOWN_SEC) {
      if (opts.reuseRecent) return { ok: true };
      const wait = Math.ceil(OTP_RESEND_COOLDOWN_SEC - ageSec);
      return { ok: false, state: { error: t("auth.waitBeforeNew", { wait: waitText(wait, t) }), tone: "info" } };
    }
  }

  const code = generateOtpCode();
  const now = new Date();
  const [, otp] = await db.$transaction([
    db.otpCode.updateMany({ where: { email: key, consumedAt: null }, data: { consumedAt: now } }),
    db.otpCode.create({
      data: { email: key, codeHash: hashOtp(key, code), expiresAt: new Date(now.getTime() + OTP_TTL_SEC * 1000), requestIp: ip },
    }),
  ]);

  try {
    await sendOtpEmail(to, code, locale);
  } catch (err) {
    await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    console.error("[admin-otp] فشل إرسال البريد", err instanceof EmailSendError ? err.message : err);
    return { ok: false, state: { error: t("auth.sendFailed") } };
  }
  return { ok: true };
}

/** الخطوة 1: اسم المستخدم وكلمة المرور. الدخول لا يكتمل إلا بعد رمز البريد. */
export async function adminLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getT();
  const parsed = adminLoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  const username = String(formData.get("username") ?? "");
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.x), values: { username } };

  const meta = await requestMeta();
  const byIp = await hitRateLimit(`admin-login:ip:${meta.ip}`, 10, 15 * 60);
  if (!byIp.allowed) {
    return { error: t("auth.tooManyDevice", { wait: waitText(byIp.retryAfterSec, t) }), tone: "warning", values: { username } };
  }

  const admin = await db.admin.findUnique({ where: { username: parsed.data.username } });

  if (admin?.lockedUntil && admin.lockedUntil > new Date()) {
    const sec = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 1000);
    return { error: t("adminLogin.locked", { wait: waitText(sec, t) }), tone: "warning", values: { username } };
  }

  const valid = await verifyPassword(admin?.passwordHash ?? null, parsed.data.password);

  if (!admin || !valid || !admin.isActive) {
    if (admin) {
      const failed = admin.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED;
      await db.admin.update({
        where: { id: admin.id },
        data: lock
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) }
          : { failedLoginCount: failed },
      });
      await audit({ adminId: admin.id, action: lock ? "admin.locked" : "admin.login_failed", entityType: "admin", entityId: admin.id, ip: meta.ip });
      if (lock) {
        return { error: t("adminLogin.lockedNow", { minutes: LOCK_MINUTES, max: MAX_FAILED }), tone: "warning", values: { username } };
      }
    }
    return { error: t("adminLogin.invalid"), values: { username } };
  }

  const issued = await issueAdminOtp(admin.id, { reuseRecent: true });
  if (!issued.ok) return { ...issued.state, values: { username } };

  await setPendingAdmin(admin.id);
  await audit({ adminId: admin.id, action: "admin.otp_sent", entityType: "admin", entityId: admin.id, ip: meta.ip });
  redirect(adminLoginPath());
}

/** الخطوة 2: رمز البريد. */
export async function adminVerifyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const adminId = await getPendingAdmin();
  if (!adminId) redirect(adminLoginPath());

  const { t } = await getT();
  const parsed = otpCodeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!parsed.success) return { fields: { code: t.x(parsed.error.issues[0].message) } };
  const code = parsed.data;

  const meta = await requestMeta();
  const byIp = await hitRateLimit(`admin-verify:ip:${meta.ip}`, 30, 15 * 60);
  if (!byIp.allowed) {
    return { error: t("auth.tooMany", { wait: waitText(byIp.retryAfterSec, t) }), tone: "warning" };
  }

  const key = adminOtpKey(adminId);
  const otp = await db.otpCode.findFirst({ where: { email: key, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.expiresAt <= new Date()) return { error: t("auth.codeExpired"), tone: "warning" };
  // حد ثانٍ لكل أدمن، لا يتأثر بتغيير عنوان IP
  const byAdmin = await hitRateLimit(`admin-verify:${adminId}`, 15, 15 * 60);
  if (!byAdmin.allowed) {
    return { error: t("auth.tooMany", { wait: waitText(byAdmin.retryAfterSec, t) }), tone: "warning" };
  }

  // المحاولة تُحجز قبل المقارنة، فلا تتجاوز الطلبات المتزامنة حد المحاولات
  const left = await reserveOtpAttempt(otp.id, otp.attempts);
  if (left === null) {
    await db.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
    return { error: t("auth.attemptsExhausted"), tone: "warning" };
  }

  if (!otpMatches(otp.codeHash, key, code)) {
    await audit({ adminId, action: "admin.otp_failed", entityType: "admin", entityId: adminId, ip: meta.ip });
    if (left <= 0) {
      await db.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      return { error: t("auth.wrongNoAttempts"), tone: "error" };
    }
    return { error: t("auth.wrongCode", { n: left }), tone: "error" };
  }

  // استهلاك الرمز مرة واحدة فقط حتى لو وصل طلبان في نفس اللحظة
  const consumed = await db.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) return { error: t("auth.codeExpired"), tone: "warning" };

  // قد يكون الحساب عُطّل أو قُفل بعد إرسال الرمز
  const admin = await db.admin.findUnique({ where: { id: adminId } });
  if (!admin || !admin.isActive || (admin.lockedUntil && admin.lockedUntil > new Date())) {
    await clearPendingAdmin();
    return { error: t("adminLogin.invalid") };
  }

  await db.admin.update({
    where: { id: admin.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createAdminSession(admin.id, meta);
  await clearPendingAdmin();
  await audit({ adminId: admin.id, action: "admin.login", entityType: "admin", entityId: admin.id, ip: meta.ip });
  redirect("/admin/clients");
}

/** زر «إعادة الإرسال» في شاشة الرمز. */
export async function adminResendAction(_prev: ActionState): Promise<ActionState> {
  const adminId = await getPendingAdmin();
  if (!adminId) redirect(adminLoginPath());

  const result = await issueAdminOtp(adminId, { reuseRecent: false });
  if (!result.ok) return result.state;
  const { t } = await getT();
  return { ok: true, message: t("auth.resent") };
}

/** الرجوع من شاشة الرمز لإدخال اسم مستخدم آخر. */
export async function adminCancelOtpAction() {
  await clearPendingAdmin();
  redirect(adminLoginPath());
}

export async function adminLogoutAction() {
  const s = await getAdminSession();
  await destroySession("ADMIN");
  if (s) await audit({ adminId: s.admin.id, action: "admin.logout", entityType: "admin", entityId: s.admin.id });
  redirect(adminLoginPath());
}

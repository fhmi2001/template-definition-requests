import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/server/db";
import { env, isProduction } from "@/server/env";

export const USER_COOKIE = "tdr_session";
export const ADMIN_COOKIE = "tdr_admin";
const OTP_EMAIL_COOKIE = "tdr_otp_email";

const USER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 أيام
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000; // 8 ساعات

type Actor = "USER" | "ADMIN";

const secretKey = () => new TextEncoder().encode(env().SESSION_SECRET);

async function signToken(sid: string, actor: Actor, expiresAt: Date) {
  return new SignJWT({ sid })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(actor)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());
}

/** يعيد معرّف الجلسة من التوكن، أو null إن كان مزوّراً أو منتهياً. */
export async function readSessionId(token: string | undefined, actor: Actor) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], audience: actor });
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

function cookieOptions(expires: Date, path: string) {
  return { httpOnly: true, secure: isProduction(), sameSite: "lax" as const, path, expires };
}

export async function createUserSession(userId: string, meta: { ip: string; userAgent: string }) {
  const expiresAt = new Date(Date.now() + USER_TTL_MS);
  const session = await db.session.create({
    data: { actor: "USER", userId, expiresAt, ipAddress: meta.ip, userAgent: meta.userAgent },
  });
  const token = await signToken(session.id, "USER", expiresAt);
  (await cookies()).set(USER_COOKIE, token, cookieOptions(expiresAt, "/"));
}

export async function createAdminSession(adminId: string, meta: { ip: string; userAgent: string }) {
  const expiresAt = new Date(Date.now() + ADMIN_TTL_MS);
  const session = await db.session.create({
    data: { actor: "ADMIN", adminId, expiresAt, ipAddress: meta.ip, userAgent: meta.userAgent },
  });
  const token = await signToken(session.id, "ADMIN", expiresAt);
  // كوكي الأدمن لا يُرسل إلا لمسارات /admin
  (await cookies()).set(ADMIN_COOKIE, token, cookieOptions(expiresAt, "/admin"));
}

/** يلغي الجلسة في قاعدة البيانات ويحذف الكوكي. */
export async function destroySession(actor: Actor) {
  const store = await cookies();
  const name = actor === "USER" ? USER_COOKIE : ADMIN_COOKIE;
  const sid = await readSessionId(store.get(name)?.value, actor);
  if (sid) {
    await db.session.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  store.delete({ name, path: actor === "USER" ? "/" : "/admin" });
}

/** كوكي مؤقت يحفظ البريد بين شاشة البريد وشاشة الرمز (بدل وضعه في الرابط). */
export async function setPendingOtpEmail(email: string) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("OTP")
    .setExpirationTime(expiresAt)
    .sign(secretKey());
  (await cookies()).set(OTP_EMAIL_COOKIE, token, cookieOptions(expiresAt, "/"));
}

export async function getPendingOtpEmail() {
  const token = (await cookies()).get(OTP_EMAIL_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], audience: "OTP" });
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function clearPendingOtpEmail() {
  (await cookies()).delete({ name: OTP_EMAIL_COOKIE, path: "/" });
}

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * مقارنة رمز بزمن ثابت: نقارن بصمتَي SHA-256 (طولهما واحد دائماً) حتى لا يتسرب طول الرمز أو موضع الاختلاف.
 */
export function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** يستخرج الرمز من ترويسة Authorization: Bearer <token>. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer ([A-Za-z0-9._~+/=-]{20,512})$/.exec(header.trim());
  return m ? m[1] : null;
}

/** هل عنوان IP ضمن القائمة المسموحة؟ القائمة الفارغة = بلا تقييد. */
export function ipAllowed(ip: string, allowedCsv: string | undefined): boolean {
  const list = (allowedCsv ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || list.includes(ip);
}

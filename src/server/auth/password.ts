import "server-only";
import { hash, verify } from "@node-rs/argon2";

// إعدادات Argon2id الموصى بها من OWASP (19 MiB، تكراران)
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

let dummyHash: Promise<string> | null = null;

/**
 * يتحقق من كلمة المرور. إذا لم يوجد حساب نتحقق مقابل hash وهمي
 * حتى يستغرق الرد نفس الوقت تقريباً (لا يكشف وجود اسم المستخدم من التوقيت).
 */
export async function verifyPassword(storedHash: string | null, password: string) {
  if (!storedHash) {
    dummyHash ??= hashPassword("dummy-password-for-timing");
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

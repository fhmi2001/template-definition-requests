import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "مطلوب"),
  SESSION_SECRET: z.string().min(32, "يجب أن يكون 32 حرفاً على الأقل"),
  OTP_SECRET: z.string().min(32, "يجب أن يكون 32 حرفاً على الأقل"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("Template Definition Requests <onboarding@resend.dev>"),
  // بوابة البريد المركزية (بديل Resend المباشر): المرسل يُحدَّد في إعدادات البوابة
  EMAIL_GATEWAY_URL: z.string().url().optional(),
  EMAIL_GATEWAY_KEY: z.string().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
  // الرابط العام للتطبيق (لصورة الشعار في البريد عبر البوابة)
  APP_URL: z.string().url().optional(),
  // رمز دخول المشرف يُرسل إلى بريده الخاص في حسابه (admins.email)؛ لا يوجد بريد إدارة مشترك.
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** يقرأ متغيرات البيئة ويتحقق منها عند أول استخدام (وليس أثناء البناء). */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse({
    ...process.env,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    EMAIL_GATEWAY_URL: process.env.EMAIL_GATEWAY_URL || undefined,
    EMAIL_GATEWAY_KEY: process.env.EMAIL_GATEWAY_KEY || undefined,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || undefined,
    APP_URL: process.env.APP_URL || undefined,
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ");
    throw new Error(`إعدادات ملف .env ناقصة أو غير صحيحة → ${details}`);
  }
  const hasGateway = Boolean(parsed.data.EMAIL_GATEWAY_URL && parsed.data.EMAIL_GATEWAY_KEY);
  if (parsed.data.NODE_ENV === "production" && !parsed.data.RESEND_API_KEY && !hasGateway) {
    throw new Error("RESEND_API_KEY أو EMAIL_GATEWAY_URL مع EMAIL_GATEWAY_KEY مطلوب في بيئة الإنتاج");
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

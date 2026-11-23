import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "مطلوب"),
  SESSION_SECRET: z.string().min(32, "يجب أن يكون 32 حرفاً على الأقل"),
  OTP_SECRET: z.string().min(32, "يجب أن يكون 32 حرفاً على الأقل"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().min(3).default("Template Definition Requests <onboarding@resend.dev>"),
  // رمز واجهة الوكلاء (/api/agent/*). اختياري: بدونه تُعطَّل الواجهة وتُرجع 404.
  AGENT_API_TOKEN: z.string().min(40, "يجب أن يكون 40 حرفاً على الأقل").optional(),
  // قائمة عناوين IP المسموحة لواجهة الوكلاء، مفصولة بفواصل (اختياري).
  AGENT_API_ALLOWED_IPS: z.string().optional(),
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
    AGENT_API_TOKEN: process.env.AGENT_API_TOKEN || undefined,
    AGENT_API_ALLOWED_IPS: process.env.AGENT_API_ALLOWED_IPS || undefined,
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ");
    throw new Error(`إعدادات ملف .env ناقصة أو غير صحيحة → ${details}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY مطلوب في بيئة الإنتاج");
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

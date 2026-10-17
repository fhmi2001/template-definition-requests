import { z } from "zod";

export const emailSchema = z
  .string({ error: "v.email.required" })
  .trim()
  .toLowerCase()
  .min(1, { error: "v.email.required" })
  .max(254, { error: "v.email.tooLong" })
  .pipe(z.email({ error: "v.email.invalid" }));

export const otpCodeSchema = z
  .string({ error: "v.otp.required" })
  .trim()
  .regex(/^\d{6}$/, { error: "v.otp.format" });

export const adminLoginSchema = z.object({
  username: z
    .string({ error: "v.username.required" })
    .trim()
    .toLowerCase()
    .min(1, { error: "v.username.required" })
    .max(50),
  password: z
    .string({ error: "v.password.required" })
    .min(1, { error: "v.password.required" })
    .max(200),
});

/** يفكك نصاً فيه إيميلات مفصولة بسطر جديد أو فاصلة أو مسافة، ويزيل المكرر. */
export function splitEmails(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;،]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export const emailListSchema = z
  .string()
  .transform(splitEmails)
  .pipe(
    z
      .array(emailSchema)
      .min(1, { error: "v.emails.min" })
      .max(50, { error: "v.emails.max" }),
  );

export const clientNameSchema = z
  .string({ error: "v.clientName.required" })
  .trim()
  .min(2, { error: "v.clientName.short" })
  .max(200, { error: "v.clientName.long" });

export const clientNotesSchema = z
  .string()
  .trim()
  .max(500, { error: "v.notes.long" })
  .transform((v) => (v ? v : null));

export const createClientSchema = z.object({
  name: clientNameSchema,
  notes: clientNotesSchema,
  emails: emailListSchema,
});

export const updateClientSchema = z.object({
  name: clientNameSchema,
  notes: clientNotesSchema,
});

export const uuidSchema = z.uuid({ error: "v.uuid" });

/** يحوّل أخطاء Zod إلى { حقل: رسالة } لعرضها تحت كل حقل. */
/** يحوّل أخطاء Zod إلى { حقل: رسالة مترجمة } لعرضها تحت كل حقل. */
export function fieldErrors(error: z.ZodError, t: (keyOrText: string) => string) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = t(issue.message);
  }
  return out;
}

// -----------------------------------------------------------------------------
// أسماء المرسلين
// -----------------------------------------------------------------------------

/** مفتاح ترجمة: يُعرض عبر t() */
export const SENDER_NAME_RULE = "v.senderName.rule";

export const senderNameSchema = z
  .string({ error: "v.senderName.required" })
  .trim()
  .min(1, { error: "v.senderName.required" })
  .max(11, { error: "v.senderName.max" })
  .regex(/^[A-Za-z0-9 ._&-]+$/, { error: "v.senderName.chars" });

export const senderFormSchema = z.object({
  name: senderNameSchema,
  description: z
    .string()
    .trim()
    .max(500, { error: "v.description.long" })
    .transform((v) => (v ? v : null)),
});

// -----------------------------------------------------------------------------
// ربط أسماء المرسلين بالعميل
// -----------------------------------------------------------------------------

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** نفس تنظيف ملف الإكسل لاسم المرسل: بدون رموز خفية، ومسافة واحدة. */
export const cleanSenderName = (v: string) => v.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();

/** مفتاح المطابقة المخزّن في name_key. */
export const senderNameKey = (v: string) => cleanSenderName(v).toLowerCase();

/**
 * أسماء مرسلين مفصولة بسطر جديد أو فاصلة (المسافة جزء من الاسم مثل «Gulf Motors»).
 * يزيل المكرر بغض النظر عن حالة الأحرف.
 */
export function splitSenderNames(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\r\n,;،|]+/)) {
    const name = cleanSenderName(part);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export const senderNameListSchema = z
  .string()
  .transform(splitSenderNames)
  .pipe(z.array(z.string()).max(100, { error: "v.senderNames.max" }));

// -----------------------------------------------------------------------------
// مراحل الطلب
// -----------------------------------------------------------------------------

const oneLine = (v: string) => v.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();

/** Client Name عند اختيار نوع Awareness. */
export const awarenessClientNameSchema = z
  .string({ error: "v.awarenessName.required" })
  .transform(oneLine)
  .pipe(
    z
      .string()
      .min(2, { error: "v.awarenessName.required" })
      .max(255, { error: "v.awarenessName.long" })
      .refine((v) => !/[{}]/.test(v), { error: "v.awarenessName.braces" })
      .refine((v) => !/#\s*var\s*\d/i.test(v), { error: "v.awarenessName.token" }),
  );

export const templateSchema = z.object({
  templateName: z
    .string({ error: "v.templateName.required" })
    .transform(oneLine)
    .pipe(z.string().min(1, { error: "v.templateName.required" }).max(100, { error: "v.templateName.long" })),
  templateDescription: z
    .string({ error: "v.templateDescription.required" })
    .transform((v) => v.replace(INVISIBLE, "").replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().min(1, { error: "v.templateDescription.required" }).max(1000, { error: "v.templateDescription.long" })),
});


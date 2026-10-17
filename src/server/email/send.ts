import "server-only";
import { Resend } from "resend";
import { env } from "@/server/env";
import { LOGO_ATTACHMENT } from "./logo";

type SendResult = { status: "SENT" | "FAILED" | "SKIPPED"; error?: string };

/**
 * يرسل بريداً عبر Resend (مع الشعار مرفقاً داخل الرسالة) ويعيد النتيجة بدل رمي خطأ، حتى يُسجَّل في سجل الطلب.
 * بدون مفتاح Resend (التطوير) يُطبع العنوان في الطرفية ويُسجَّل «لم يُرسل».
 */
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<SendResult> {
  const { RESEND_API_KEY, EMAIL_FROM, NODE_ENV } = env();
  if (NODE_ENV !== "production") console.info(`[تطوير] بريد إلى ${msg.to}: ${msg.subject}`);
  if (!RESEND_API_KEY) return { status: "SKIPPED", error: "RESEND_API_KEY is not set" };
  try {
    const { error } = await new Resend(RESEND_API_KEY).emails.send({ from: EMAIL_FROM, ...msg, attachments: [LOGO_ATTACHMENT] });
    if (error) return { status: "FAILED", error: error.message.slice(0, 480) };
    return { status: "SENT" };
  } catch (err) {
    return { status: "FAILED", error: (err instanceof Error ? err.message : String(err)).slice(0, 480) };
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

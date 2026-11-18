/** عند بدء الخادم: يبدأ صندوق إشعارات الطلبات (التجميع وإيقاف الإرسال عند نفاد الحصة) — Kairo t7fv7wm9. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureOutboxSweeper } = await import("@/server/email/outbox");
  ensureOutboxSweeper();
}

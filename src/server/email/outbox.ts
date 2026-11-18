import "server-only";
import { db } from "@/server/db";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { mailDataOf, notifyMany, notifyStatusChange, requestRecipient } from "@/server/request-review";
import { sendEmail } from "./send";
import { renderDigest } from "./request-emails";
import {
  outboxState,
  rollupConfigFromEnv,
  runFlush,
  type FlushDeps,
  type MailGroup,
  type PendingMail,
} from "@/lib/mail-rollup";

/*
 * صندوق إشعارات الطلبات (Kairo t7fv7wm9). القواعد في src/lib/mail-rollup.ts.
 * السجل الذي email_status فيه فارغ = إشعار ينتظر. كل دقيقة يُرسل ما حان وقته: رسالة واحدة لكل
 * عميل + نوع (استلام / تغيير حالة) + لغة. رموز الدخول لا تمر من هنا أبداً.
 * التشغيل: نسخة واحدة (pm2 fork)؛ داخل العملية تُنفَّذ الدفعات بالتتابع (لا إرسال مزدوج).
 */

const SWEEP_MS = 60_000;
const MAX_PENDING_SCAN = 2000;

type Globals = { __tmOutboxChain?: Promise<unknown>; __tmOutboxTimer?: ReturnType<typeof setInterval> };
const g = globalThis as unknown as Globals;

/** EMAIL_ROLLUP=on|off. بدونه: يعمل حين تكون بوابة البريد مهيأة (استضافتنا)، ويبقى السلوك القديم غير ذلك. */
export function rollupEnabled() {
  const v = (process.env.EMAIL_ROLLUP ?? "").trim().toLowerCase();
  if (["off", "0", "false", "no"].includes(v)) return false;
  if (["on", "1", "true", "yes"].includes(v)) return true;
  return Boolean(process.env.EMAIL_GATEWAY_URL && process.env.EMAIL_GATEWAY_KEY);
}

const changeInclude = {
  request: {
    include: {
      client: { select: { name: true } },
      user: { select: { email: true, isActive: true } },
      sender: { select: { clientName: true } },
    },
  },
} as const;

const deps: FlushDeps = {
  async loadPending() {
    const rows = await db.requestStatusChange.findMany({
      where: { emailStatus: null },
      orderBy: { createdAt: "asc" },
      take: MAX_PENDING_SCAN,
      select: {
        id: true,
        adminId: true,
        toStatus: true,
        createdAt: true,
        request: { select: { clientId: true, locale: true, user: { select: { email: true, isActive: true } } } },
      },
    });
    const recipients = new Map<string, Promise<string | null>>();
    const out: PendingMail[] = [];
    for (const c of rows) {
      const r = c.request;
      const k = `${r.clientId}|${r.user?.email ?? ""}|${r.user?.isActive ?? ""}`;
      if (!recipients.has(k)) recipients.set(k, requestRecipient(r));
      out.push({
        id: c.id,
        to: await recipients.get(k)!,
        kind: c.adminId === null && c.toStatus === "RECEIVED" ? "received" : "status",
        locale: isLocale(r.locale) ? r.locale : DEFAULT_LOCALE,
        createdAt: c.createdAt,
      });
    }
    return out;
  },

  async send(group: MailGroup) {
    try {
      const rows = await db.requestStatusChange.findMany({ where: { id: { in: group.ids } }, include: changeInclude });
      const byId = new Map(rows.map((c) => [c.id, c]));
      const items = group.ids.flatMap((id) => {
        const c = byId.get(id);
        return c ? [mailDataOf(c.request, c)] : [];
      });
      if (items.length === 0) return { status: "SKIPPED" as const, error: "request removed" };
      const locale = isLocale(group.locale) ? group.locale : DEFAULT_LOCALE;
      return await sendEmail({ to: group.to, ...renderDigest(locale, group.kind, items) });
    } catch (err) {
      return { status: "FAILED" as const, error: (err instanceof Error ? err.message : String(err)).slice(0, 480) };
    }
  },

  async mark(ids, to, outcome) {
    await db.requestStatusChange.updateMany({
      where: { id: { in: ids }, emailStatus: null },
      data: { emailTo: to, emailStatus: outcome.status, emailError: outcome.error?.slice(0, 480) ?? null },
    });
  },

  log: (m) => console.warn(m),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** دفعة واحدة من الصندوق. force = سجلات تُرسل الآن دون انتظار النافذة (إعادة إرسال يطلبها المشرف). */
export function flushOutbox(force: string[] = []) {
  const run = (g.__tmOutboxChain ?? Promise.resolve())
    .catch(() => {})
    .then(() => runFlush(deps, outboxState(), rollupConfigFromEnv(process.env), new Date(), new Set(force)));
  g.__tmOutboxChain = run.catch(() => {});
  return run;
}

/** يبدأ المسح الدوري مرة واحدة لكل عملية (من instrumentation، واحتياطاً عند أول إشعار). */
export function ensureOutboxSweeper() {
  if (!rollupEnabled() || g.__tmOutboxTimer) return;
  g.__tmOutboxTimer = setInterval(() => {
    flushOutbox().catch((err) => console.error("[mail-outbox] sweep failed", err));
  }, SWEEP_MS);
  g.__tmOutboxTimer.unref?.();
}

/** إشعارات جديدة (تقديم أو تغيير حالة): تنتظر في الصندوق، أو تُرسل فوراً إن كان التجميع معطلاً. */
export async function queueNotifications(changeIds: string[]) {
  if (!rollupEnabled()) {
    if (changeIds.length === 1) await notifyStatusChange(changeIds[0]);
    else await notifyMany(changeIds);
    return;
  }
  ensureOutboxSweeper();
}

/** إعادة إرسال يطلبها المشرف: تُرسل الآن (مع أي إشعارات تنتظر لنفس العميل)، إلا إذا كانت الحصة اليومية منتهية. */
export async function resendNow(changeId: string) {
  if (!rollupEnabled()) return notifyStatusChange(changeId);
  ensureOutboxSweeper();
  await flushOutbox([changeId]).catch((err) => console.error("[mail-outbox] resend failed", err));
}

import "server-only";
import { db } from "@/server/db";

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

/**
 * عدّاد بنافذة زمنية ثابتة محفوظ في قاعدة البيانات، فيعمل حتى مع عدة خوادم.
 * كل استدعاء يحسب محاولة؛ يُرفض الطلب عند تجاوز `limit` داخل `windowSec`.
 */
export async function hitRateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; retry_after: number }[]>`
    INSERT INTO "rate_limits" ("key", "count", "window_start")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."window_start" < now() - (${windowSec}::int * interval '1 second') THEN 1
        ELSE "rate_limits"."count" + 1 END,
      "window_start" = CASE
        WHEN "rate_limits"."window_start" < now() - (${windowSec}::int * interval '1 second') THEN now()
        ELSE "rate_limits"."window_start" END
    RETURNING "count",
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("window_start" + (${windowSec}::int * interval '1 second') - now()))))::int AS retry_after`;

  const row = rows[0];
  return { allowed: Number(row.count) <= limit, retryAfterSec: Number(row.retry_after) };
}

/** مدة الانتظار بلغة المستخدم. */
export function waitText(seconds: number, t: (key: "count.seconds" | "count.minutes", p: { n: number }) => string) {
  if (seconds < 60) return t("count.seconds", { n: Math.max(1, seconds) });
  return t("count.minutes", { n: Math.ceil(seconds / 60) });
}

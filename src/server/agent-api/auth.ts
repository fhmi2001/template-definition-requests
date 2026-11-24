import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { hitRateLimit } from "@/server/auth/rate-limit";
import { requestMeta } from "@/server/http-meta";
import { bearerToken, ipAllowed, tokenMatches } from "./token";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });

/**
 * يتحقق من أي طلب إلى /api/agent/*. يُرجع Response عند الرفض، أو null عند القبول.
 *  - بلا AGENT_API_TOKEN في البيئة: الواجهة معطّلة وتبدو غير موجودة (404).
 *  - HTTPS فقط خارج التطوير.
 *  - قائمة IP اختيارية.
 *  - الرمز بمقارنة زمن ثابت، والمحاولات الفاشلة محدودة لكل IP (10 كل 10 دقائق)، والاستخدام الناجح 120 طلباً/دقيقة.
 */
export async function authenticateAgent(request: Request): Promise<Response | null> {
  const e = env();
  if (!e.AGENT_API_TOKEN) return json({ error: "not_found" }, 404);

  if (e.NODE_ENV === "production") {
    const proto = request.headers.get("x-forwarded-proto");
    if (proto && proto !== "https") return json({ error: "https_required" }, 400);
  }

  const { ip } = await requestMeta();
  if (!ipAllowed(ip, e.AGENT_API_ALLOWED_IPS)) return json({ error: "forbidden" }, 403);

  const token = bearerToken(request.headers.get("authorization"));
  if (!token || !tokenMatches(token, e.AGENT_API_TOKEN)) {
    const fail = await hitRateLimit(`agent-fail:${ip}`, 10, 600);
    if (!fail.allowed) return json({ error: "too_many_attempts" }, 429, { "Retry-After": String(fail.retryAfterSec) });
    return json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
  }

  const ok = await hitRateLimit(`agent-ok:${ip}`, 120, 60);
  if (!ok.allowed) return json({ error: "rate_limited" }, 429, { "Retry-After": String(ok.retryAfterSec) });
  return null;
}

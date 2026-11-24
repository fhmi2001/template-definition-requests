import { after } from "next/server";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requestMeta } from "@/server/http-meta";
import { authenticateAgent, json } from "@/server/agent-api/auth";
import { RESULTS_MAX, resultsBodySchema } from "@/server/agent-api/schemas";
import { applyStatusChange, notifyMany } from "@/server/request-review";
import { REJECTED_DEFAULT_REF, authorityRefRequired } from "@/lib/review-status";

export const dynamic = "force-dynamic";

const BODY_MAX_BYTES = 64 * 1024;

type Outcome = { referenceNo: number | null; outcome: "changed" | "unchanged" | "not_found" | "conflict" | "needs_authority_ref" | "invalid"; detail?: string };

/**
 * POST /api/agent/results
 * { "notify": true, "results": [{ "referenceNo": 462, "status": "APPROVED", "authorityRef": "NTR-2611-MO-P005-3121" },
 *                                { "referenceNo": "TDR-000474", "status": "REJECTED", "reason": "<Mobily message + ترجمة>" }] }
 * ينقل الطلبات للأمام فقط (UNDER_REVIEW / APPROVED / REJECTED). إعادة إرسال النتيجة نفسها آمنة (unchanged).
 */
export async function POST(request: Request) {
  const denied = await authenticateAgent(request);
  if (denied) return denied;

  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return json({ error: "json_required" }, 415);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > BODY_MAX_BYTES) return json({ error: "body_too_large" }, 413);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = resultsBodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "invalid_body", max: RESULTS_MAX, issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  }
  const { results, notify } = parsed.data;
  if (new Set(results.map((r) => r.referenceNo)).size !== results.length) return json({ error: "duplicate_referenceNo" }, 400);

  const ip = (await requestMeta()).ip;
  const outcomes: Outcome[] = [];
  const changeIds: string[] = [];

  for (const item of results) {
    const found = await db.templateRequest.findFirst({
      where: { referenceNo: item.referenceNo, status: "SUBMITTED" },
      select: { id: true, reviewStatus: true, referenceNo: true, authorityRef: true },
    });
    if (!found || found.referenceNo === null) {
      outcomes.push({ referenceNo: item.referenceNo, outcome: "not_found" });
      continue;
    }
    if (found.reviewStatus === item.status) {
      outcomes.push({ referenceNo: item.referenceNo, outcome: "unchanged" });
      continue;
    }
    const authorityRef = item.authorityRef ?? found.authorityRef ?? (item.status === "REJECTED" ? REJECTED_DEFAULT_REF : null);
    if (authorityRefRequired(item.status) && !authorityRef) {
      outcomes.push({ referenceNo: item.referenceNo, outcome: "needs_authority_ref" });
      continue;
    }
    const changeId = await applyStatusChange({
      adminId: null,
      ip,
      request: { id: found.id, reviewStatus: found.reviewStatus, referenceNo: found.referenceNo },
      status: item.status,
      reason: item.status === "REJECTED" ? (item.reason ?? "") : "",
      authorityRef,
      silent: !notify,
      via: "agent-api",
    });
    if (!changeId) {
      outcomes.push({ referenceNo: item.referenceNo, outcome: "conflict", detail: "status changed meanwhile; re-read and retry" });
      continue;
    }
    changeIds.push(changeId);
    outcomes.push({ referenceNo: item.referenceNo, outcome: "changed" });
  }

  if (notify && changeIds.length) after(() => notifyMany(changeIds));
  await audit({
    adminId: null,
    action: "agent.results_write",
    entityType: "template_request",
    metadata: { total: results.length, changed: changeIds.length, notify, via: "agent-api" },
    ip,
  });

  return json({ changed: changeIds.length, results: outcomes });
}

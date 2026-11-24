import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requestMeta } from "@/server/http-meta";
import { authenticateAgent, json } from "@/server/agent-api/auth";
import { mobilyClassification, mobilyVariables } from "@/server/agent-api/mobily";
import { composeMessage, messageSignature } from "@/lib/template-rules";
import { referenceText } from "@/server/requests";

export const dynamic = "force-dynamic";

const STATUSES = ["RECEIVED", "UNDER_REVIEW"] as const;

/**
 * GET /api/agent/requests?status=RECEIVED&limit=25&excludeSender=Janalkhair,Other
 * قراءة فقط: الطلبات المقدَّمة بحالة «مستلم» (أو «لدى الهيئة» لمعرفة ما ينتظر نتيجة)، من الأقدم، مع كل ما يلزم لتقديمها في Mobily.
 */
export async function GET(request: Request) {
  const denied = await authenticateAgent(request);
  if (denied) return denied;

  const q = new URL(request.url).searchParams;
  const status = q.get("status") ?? "RECEIVED";
  if (!(STATUSES as readonly string[]).includes(status)) return json({ error: "invalid_status", allowed: STATUSES }, 400);
  const limitRaw = Number(q.get("limit") ?? 25);
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 ? Math.min(limitRaw, 50) : 25;
  const exclude = (q.get("excludeSender") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

  const rows = await db.templateRequest.findMany({
    where: {
      status: "SUBMITTED",
      reviewStatus: status as (typeof STATUSES)[number],
      ...(exclude.length ? { NOT: exclude.map((name) => ({ senderName: { equals: name, mode: "insensitive" as const } })) } : {}),
    },
    orderBy: [{ submittedAt: "asc" }, { referenceNo: "asc" }],
    take: limit,
    include: {
      client: { select: { name: true } },
      sender: { select: { clientName: true, customerType: true, enterpriseUnifiedNumber: true, crNumber: true } },
    },
  });

  await audit({ adminId: null, action: "agent.requests_read", entityType: "template_request", metadata: { status, count: rows.length, via: "agent-api" }, ip: (await requestMeta()).ip });

  return json({
    count: rows.length,
    requests: rows.map((r) => ({
      referenceNo: r.referenceNo,
      reference: referenceText(r.referenceNo),
      reviewStatus: r.reviewStatus,
      authorityRef: r.authorityRef,
      submittedAt: r.submittedAt,
      locale: r.locale,
      sender: {
        name: r.senderName,
        type: r.senderType,
        mobilyClassification: mobilyClassification(r.senderType),
        awarenessClientName: r.awarenessClientName,
      },
      customer: {
        name: r.sender?.clientName ?? r.client.name,
        type: r.customerType ?? r.sender?.customerType ?? null,
        enterpriseUnifiedNumber: r.sender?.enterpriseUnifiedNumber ?? null,
        crNumber: r.sender?.crNumber ?? null,
      },
      template: {
        name: r.templateName,
        description: r.templateDescription,
        content: r.content,
        /** النص كما يُلصق في Mobily (مع سطر Client Name للتوعوي). */
        message: composeMessage(r.content ?? "", messageSignature(r.senderType, r.awarenessClientName)),
        variables: mobilyVariables(r.variables),
      },
    })),
  });
}

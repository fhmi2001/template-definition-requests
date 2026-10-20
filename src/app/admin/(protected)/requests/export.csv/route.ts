import { db } from "@/server/db";
import { getAdminSession } from "@/server/auth/dal";
import { getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/format";
import { senderTypeDisplay } from "@/lib/sender-types";
import { composeMessage, exceptionLabel, messageSignature, sanitizeSpecs, tokenText, variableTypeLabel } from "@/lib/template-rules";
import { referenceText } from "@/server/requests";
import { buildWhere, orderBy, parseFilters } from "@/server/admin-requests";

const MAX_ROWS = 20_000;

/** خلية CSV آمنة: تهريب الاقتباس، ومنع تنفيذ المعادلات عند فتح الملف في Excel. */
function cell(value: string | number | null | undefined) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** تصدير الطلبات بنفس فلاتر الجدول. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return new Response("Unauthorized", { status: 401 });
  const { t, locale } = await getT();
  const f = parseFilters(Object.fromEntries(new URL(req.url).searchParams));

  const rows = await db.templateRequest.findMany({
    where: buildWhere(f),
    orderBy: orderBy(f),
    take: MAX_ROWS,
    include: { client: { select: { name: true } }, user: { select: { email: true } }, sender: { select: { clientName: true, enterpriseUnifiedNumber: true, crNumber: true } } },
  });

  const header = [
    t("rq.th.ref"),
    t("authorityRef.label"),
    t("rq.th.submitted"),
    t("col.status"),
    t("rq.th.reviewed"),
    t("mail.reason"),
    t("col.client"),
    t("ent.unified"),
    t("ent.cr"),
    t("rq.th.by"),
    t("col.senderName"),
    t("col.clientName"),
    t("col.senderType"),
    "Client Name",
    t("template.name"),
    t("template.description"),
    t("content.title"),
    t("content.varsTitle"),
    "Customer Type",
    t("details.exceptions"),
  ];
  const lines = [
    header.map(cell).join(","),
    ...rows.map((r) => {
      const specs = sanitizeSpecs(r.variables);
      return [
        referenceText(r.referenceNo),
        r.authorityRef ?? "",
        formatDateTime(r.submittedAt, locale),
        r.reviewStatus ? t(`rv.${r.reviewStatus}`) : "",
        r.reviewedAt ? formatDateTime(r.reviewedAt, locale) : "",
        r.reviewStatus === "REJECTED" ? r.rejectionReason : "",
        r.client.name,
        r.sender?.enterpriseUnifiedNumber ?? "",
        r.sender?.crNumber ?? "",
        r.user?.email,
        r.senderName,
        r.sender?.clientName,
        r.senderType ? senderTypeDisplay(t, r.senderType) : "",
        r.awarenessClientName,
        r.templateName,
        r.templateDescription,
        composeMessage(r.content ?? "", messageSignature(r.senderType, r.awarenessClientName)),
        specs.map((s, i) => `${tokenText(i + 1)} ${variableTypeLabel(t, s.type)}${s.length ? ` ${s.length}` : ""}`).join(" | "),
        r.customerType,
        r.exceptions.map((e) => exceptionLabel(t, e)).join(" | "),
      ]
        .map(cell)
        .join(",");
    }),
  ];
  // BOM حتى يعرض Excel النص العربي بشكل صحيح
  const body = "﻿" + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="template-requests-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

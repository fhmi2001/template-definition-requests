import { db } from "@/server/db";
import { getAdminSession } from "@/server/auth/dal";
import { uuidSchema } from "@/lib/validation";
import { getT } from "@/i18n/server";
import { translateStored } from "@/i18n/translate";

/** خلية CSV آمنة: تهريب الاقتباس، ومنع تنفيذ المعادلات عند فتح الملف في Excel. */
function cell(value: string | number | null) {
  let s = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return new Response("Unauthorized", { status: 401 });
  const { t, locale } = await getT();
  const parsed = uuidSchema.safeParse((await params).id);
  if (!parsed.success) return new Response("Not found", { status: 404 });

  const batch = await db.importBatch.findUnique({ where: { id: parsed.data }, select: { fileName: true } });
  if (!batch) return new Response("Not found", { status: 404 });

  const issues = await db.importIssue.findMany({
    where: { importId: parsed.data },
    orderBy: [{ rowNumber: "asc" }, { id: "asc" }],
  });

  const lines = [
    [t("ci.th.row"), "Request Id", t("ci.th.column"), t("details.type"), t("ci.th.note"), t("ir.th.fileValue")].map(cell).join(","),
    ...issues.map((i) =>
      [
        i.rowNumber || "",
        i.requestId,
        i.column,
        i.severity === "ERROR" ? t("ir.sev.error") : t("ir.sev.warning"),
        translateStored(locale, i.message),
        i.rawValue,
      ]
        .map(cell)
        .join(","),
    ),
  ];
  // BOM حتى يعرض Excel النص العربي بشكل صحيح
  const body = "﻿" + lines.join("\r\n");
  const name = `import-issues-${parsed.data.slice(0, 8)}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

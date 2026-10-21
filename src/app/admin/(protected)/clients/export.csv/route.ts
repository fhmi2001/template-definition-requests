import { getAdminSession } from "@/server/auth/dal";
import { clientsExportTable, exportStamp } from "@/server/clients-export";

/** خلية CSV آمنة: تهريب الاقتباس، ومنع تنفيذ المعادلات عند فتح الملف في Excel. */
function cell(value: string | number | null | undefined) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** تصدير العملاء بنفس فلاتر القائمة. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return new Response("Unauthorized", { status: 401 });
  const { header, rows } = await clientsExportTable(req.url);
  const lines = [header, ...rows].map((r) => r.map(cell).join(","));
  // BOM حتى يعرض Excel النص العربي بشكل صحيح
  const body = "﻿" + lines.join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${exportStamp()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

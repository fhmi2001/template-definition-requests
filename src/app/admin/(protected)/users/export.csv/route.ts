import { canExportAdmins, usersExportTable } from "@/server/users-export";
import { exportStamp } from "@/server/clients-export";

/** خلية CSV آمنة: تهريب الاقتباس، ومنع تنفيذ المعادلات عند فتح الملف في Excel. */
function cell(value: string | number | null | undefined) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** تصدير حسابات الإدارة بنفس فلاتر القائمة. */
export async function GET(req: Request) {
  if (!(await canExportAdmins())) return new Response("Not found", { status: 404 });
  const { header, rows } = await usersExportTable(req.url);
  const body = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="users-${exportStamp()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

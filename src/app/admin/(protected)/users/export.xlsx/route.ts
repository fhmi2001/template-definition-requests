import ExcelJS from "exceljs";
import { canExportAdmins, usersExportTable } from "@/server/users-export";
import { exportStamp } from "@/server/clients-export";

/** تصدير حسابات الإدارة إلى ملف Excel بنفس فلاتر القائمة. */
export async function GET(req: Request) {
  if (!(await canExportAdmins())) return new Response("Not found", { status: 404 });
  const { header, rows, locale } = await usersExportTable(req.url);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Template Definition Requests";
  const sheet = wb.addWorksheet("Users", { views: [{ state: "frozen", ySplit: 1, rightToLeft: locale === "ar" }] });
  sheet.columns = header.map((h, i) => ({ header: h, key: String(i), width: [28, 24, 34, 16, 12, 22, 16][i] ?? 20 }));
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22804E" } };
  head.height = 22;
  for (const r of rows) sheet.addRow(r);

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="users-${exportStamp()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

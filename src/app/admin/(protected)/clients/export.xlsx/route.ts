import ExcelJS from "exceljs";
import { getAdminSession } from "@/server/auth/dal";
import { clientsExportTable, exportStamp } from "@/server/clients-export";

/** تصدير العملاء إلى ملف Excel بنفس فلاتر القائمة. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return new Response("Unauthorized", { status: 401 });
  const { header, rows, locale } = await clientsExportTable(req.url);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Template Definition Requests";
  const sheet = wb.addWorksheet("Clients", { views: [{ state: "frozen", ySplit: 1, rightToLeft: locale === "ar" }] });
  sheet.columns = header.map((h, i) => ({ header: h, key: String(i), width: [36, 30, 12, 18, 46, 30, 40, 22, 26, 12, 16][i] ?? 20 }));
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22804E" } };
  head.alignment = { vertical: "middle" };
  head.height = 22;
  // القيم نصوص عادية: لا تُفسَّر كمعادلات حتى لو بدأت بـ =
  for (const r of rows) sheet.addRow(r);
  sheet.eachRow((row, n) => {
    if (n > 1) row.alignment = { vertical: "top", wrapText: true };
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="clients-${exportStamp()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

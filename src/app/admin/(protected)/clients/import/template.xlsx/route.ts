import ExcelJS from "exceljs";
import { requireAdmin } from "@/server/auth/dal";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";

/** نموذج ملف استيراد العملاء: ورقة البيانات (العناوين فقط) وورقة تعليمات بمثال. */
export async function GET() {
  await requireAdmin();
  const { t, locale } = await getT();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Template Definition Requests";

  const sheet = wb.addWorksheet("Clients");
  sheet.columns = [
    { header: "Client Name", key: "name", width: 40 },
    { header: "Email", key: "email", width: 46 },
    { header: "Sender Name", key: "sender", width: 36 },
  ];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B6E57" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const help = wb.addWorksheet(t("tpl.helpSheet"), { views: [{ rightToLeft: locale === "ar" }] });
  help.columns = [{ width: 30 }, { width: 44 }, { width: 30 }];
  const lines: MessageKey[] = ["tpl.line1", "tpl.line2", "tpl.line3", "tpl.line4", "tpl.line5", "tpl.line6"];
  help.addRow([t("tpl.helpSheet")]).font = { bold: true, size: 14 };
  for (const l of lines) help.addRow([`• ${t(l)}`]);
  help.addRow([]);
  help.addRow([t("tpl.example")]).font = { bold: true };
  const ex = help.addRow(["Client Name", "Email", "Sender Name"]);
  ex.font = { bold: true };
  help.addRow([t("tpl.exCompany"), "it@example.com, ops@example.com", "EXAMPLE, EXAMPLE-SA"]);
  help.addRow([t("tpl.exCompany"), "sales@example.com", "EXAMPLE2"]);
  help.addRow([t("tpl.exOrg"), "info@example.org", "MODEL"]);

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="clients-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

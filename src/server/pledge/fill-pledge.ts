import "server-only";
import JSZip from "jszip";
import { PLEDGE_TEMPLATE_BASE64 } from "./template-docx";

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/**
 * نسخة من خطاب التعهد معبأ فيها اسم الجهة واسم المرسل.
 * باقي الحقول (اسم المسؤول، المنصب، التوقيع والختم) يعبئها العميل.
 */
export async function fillPledge(entityName: string, senderName: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(Buffer.from(PLEDGE_TEMPLATE_BASE64, "base64"));
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("نموذج الخطاب تالف");
  let xml = await file.async("string");
  xml = xml
    .replace(":..............................", `: ${xmlEscape(entityName)}`)
    .replace("اسم المرسل (...)", `اسم المرسل (${xmlEscape(senderName)})`);
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

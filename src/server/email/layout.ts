import "server-only";
import { dirOf, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/translate";
import { escapeHtml } from "./send";
import { logoImg } from "./logo";

/** ألوان البريد (نفس هوية المنصة). */
export const MAIL = {
  canvas: "#f4f6f5",
  line: "#e2e6e3",
  hair: "#eef0ef",
  ink: "#2d2d2d",
  ink2: "#3f4542",
  muted: "#59605c",
  subtle: "#8e9792",
  brand: "#22804e",
  brandSoft: "#e8f5ed",
  brandDeep: "#134f2f",
} as const;

/** هيكل كل رسائل البريد: الشعار واسم المنصة في الأعلى، ثم المحتوى داخل بطاقة بيضاء. */
export function emailLayout(locale: Locale, body: string, maxWidth = 600) {
  const t = makeT(locale);
  const dir = dirOf(locale);
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<body style="margin:0;padding:24px;background:${MAIL.canvas};font-family:Tahoma,Arial,sans-serif;color:${MAIL.ink}">
  <div style="max-width:${maxWidth}px;margin:0 auto;background:#ffffff;border:1px solid ${MAIL.line};border-radius:14px;overflow:hidden;text-align:${dir === "rtl" ? "right" : "left"}">
    <div style="height:5px;background:#35a169"></div>
    <div style="padding:24px 32px 0">
      <div dir="ltr" style="display:inline-block">${logoImg()}</div>
      <p style="margin:8px 0 0;font-size:13px;color:${MAIL.muted}">${escapeHtml(t("app.name"))}</p>
    </div>
    <div style="padding:20px 32px 32px">
${body}
    </div>
  </div>
</body>
</html>`;
}

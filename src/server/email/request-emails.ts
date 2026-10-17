import "server-only";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { dirOf, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/translate";
import { formatDateTime } from "@/lib/format";
import { senderTypeDisplay } from "@/lib/sender-types";
import { composeMessage, exceptionLabel, markTokens, tokenText, variableTypeLabel, type VariableSpec } from "@/lib/template-rules";
import { escapeHtml as e } from "./send";

export type RequestMailData = {
  ref: string;
  submittedAt: Date | null;
  clientName: string;
  senderName: string;
  senderType: string | null;
  awarenessClientName: string | null;
  templateName: string | null;
  templateDescription: string | null;
  content: string | null;
  /** Client Name في سطر أخير ثابت (للتوعوي) */
  signature: string | null;
  specs: VariableSpec[];
  customerType: string | null;
  exceptions: string[];
  status: ReviewStatus;
  reason: string | null;
};

const STATUS_COLOR: Record<ReviewStatus, [string, string]> = {
  RECEIVED: ["#e3eef9", "#1d4f86"],
  UNDER_REVIEW: ["#fdf3dc", "#8a5a00"],
  APPROVED: ["#e3efea", "#0b6e57"],
  REJECTED: ["#fbe7e5", "#a3261b"],
};

/** رسالة البريد: عنوان، فقرة، ثم ملخص الطلب في جدول. */
function render(locale: Locale, d: RequestMailData, kind: "received" | "status") {
  const t = makeT(locale);
  const dir = dirOf(locale);
  const align = dir === "rtl" ? "right" : "left";
  const status = t(`rv.${d.status}`);
  const [bg, fg] = STATUS_COLOR[d.status];

  const heading = kind === "received" ? t("mail.received.heading") : t("mail.status.heading");
  const subject = kind === "received" ? t("mail.received.subject", { ref: d.ref }) : t("mail.status.subject", { ref: d.ref, status });
  const intro =
    kind === "received"
      ? [t("mail.received.body")]
      : [t("mail.status.body", { status }), t(`mail.status.${d.status}`)];

  // علامة اتجاه قبل كل متغير حتى يظهر #Var1# صحيحاً داخل النص العربي في برامج البريد
  const message = markTokens(composeMessage((d.content ?? "").replace(/\s+$/, ""), d.signature));
  const vars = d.specs.map((s, i) => `${markTokens(tokenText(i + 1))} — ${variableTypeLabel(t, s.type)}${s.length ? ` · ${s.length}` : ""}`);
  const rows: [string, string, boolean?][] = [
    [t("submitted.ref"), d.ref, true],
    [t("mail.f.status"), status],
    [t("mail.f.submittedAt"), formatDateTime(d.submittedAt, locale)],
    [t("col.client"), d.clientName],
    [t("col.senderName"), d.senderName, true],
    [t("col.senderType"), d.senderType ? senderTypeDisplay(t, d.senderType) : "—"],
    ...(d.awarenessClientName ? ([["Client Name", d.awarenessClientName]] as [string, string][]) : []),
    [t("template.name"), d.templateName ?? "—"],
    [t("template.description"), d.templateDescription ?? "—"],
    ["Customer Type", d.customerType ?? "—", true],
    ...(vars.length ? ([[t("content.varsTitle"), vars.join("\n")]] as [string, string][]) : []),
    ...(d.exceptions.length
      ? ([[t("details.exceptions"), d.exceptions.map((x) => exceptionLabel(t, x)).join(t("common.listSep"))]] as [string, string][])
      : []),
  ];

  const reasonBlock =
    d.status === "REJECTED" && d.reason
      ? `<div style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#fbe7e5;color:#7a1d14">
      <div style="font-size:13px;font-weight:bold;margin-bottom:6px">${e(t("mail.reason"))}</div>
      <div dir="auto" style="font-size:15px;line-height:1.8;white-space:pre-wrap;text-align:start">${e(d.reason)}</div>
    </div>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.8;color:#4a5551">${e(t("mail.rejectedHint"))}</p>`
      : "";

  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<body style="margin:0;padding:24px;background:#f4f5f2;font-family:Tahoma,Arial,sans-serif;color:#16201c">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dde1dc;border-radius:12px;padding:32px;text-align:${align}">
    <p style="margin:0 0 16px;font-size:15px;font-weight:bold">${e(t("app.name"))}</p>
    <h1 style="margin:0 0 12px;font-size:20px">${e(heading)}</h1>
    <p style="margin:0 0 16px">
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${fg};font-size:13px;font-weight:bold">${e(status)}</span>
      <span dir="ltr" style="font-family:Consolas,monospace;font-size:14px;color:#4a5551;margin:0 8px">${e(d.ref)}</span>
    </p>
    ${intro.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:#3f4945">${e(p)}</p>`).join("")}
    ${reasonBlock}
    <h2 style="margin:24px 0 10px;font-size:16px">${e(t("mail.summary"))}</h2>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([label, value, ltr]) => `<tr>
        <td style="padding:8px 0;border-top:1px solid #eceeeb;color:#6b7570;width:38%;vertical-align:top">${e(label)}</td>
        <td ${ltr ? 'dir="ltr"' : 'dir="auto"'} style="padding:8px 0;border-top:1px solid #eceeeb;vertical-align:top;white-space:pre-wrap;text-align:${align}${ltr ? ";font-family:Consolas,monospace" : ""}">${e(value)}</td>
      </tr>`,
        )
        .join("")}
    </table>
    <h2 style="margin:24px 0 10px;font-size:16px">${e(t("content.title"))}</h2>
    <div dir="auto" style="padding:14px 16px;border-radius:10px;background:#f4f5f2;font-size:15px;line-height:1.9;white-space:pre-wrap;text-align:start">${e(message || "—")}</div>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.8;color:#8a9590">${e(t("mail.footer"))}</p>
  </div>
</body>
</html>`;

  const text = [
    heading,
    `${t("submitted.ref")}: ${d.ref} · ${status}`,
    "",
    ...intro,
    ...(d.status === "REJECTED" && d.reason ? ["", `${t("mail.reason")}: ${d.reason}`, t("mail.rejectedHint")] : []),
    "",
    `${t("mail.summary")}:`,
    ...rows.map(([l, v]) => `${l}: ${v}`),
    "",
    `${t("content.title")}:`,
    message || "—",
    "",
    t("mail.footer"),
  ].join("\n");

  return { subject, html, text };
}

export const renderRequestReceived = (locale: Locale, d: RequestMailData) => render(locale, d, "received");
export const renderStatusChanged = (locale: Locale, d: RequestMailData) => render(locale, d, "status");

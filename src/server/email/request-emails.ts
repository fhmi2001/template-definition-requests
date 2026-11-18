import "server-only";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { dirOf, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/translate";
import { formatDateTime } from "@/lib/format";
import { senderTypeDisplay } from "@/lib/sender-types";
import { composeMessage, exceptionLabel, markTokens, tokenText, variableTypeLabel, type VariableSpec } from "@/lib/template-rules";
import { escapeHtml as e } from "./send";
import { MAIL, emailLayout } from "./layout";

export type RequestMailData = {
  ref: string;
  /** رقم الطلب لدى هيئة الاتصالات (بعد «لدى الهيئة») */
  authorityRef: string | null;
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
  APPROVED: ["#e8f5ed", "#1a6a3f"],
  REJECTED: ["#fbe7e5", "#a3261b"],
};

/** نص الرسالة كما سيصل: علامة اتجاه قبل كل متغير حتى يظهر #Var1# صحيحاً داخل النص العربي في برامج البريد */
function messageOf(d: RequestMailData) {
  return markTokens(composeMessage((d.content ?? "").replace(/\s+$/, ""), d.signature));
}

/** صفوف ملخص الطلب (مشتركة بين بريد الطلب الواحد وبريد الدفعة). */
function summaryRows(t: ReturnType<typeof makeT>, locale: Locale, d: RequestMailData, status: string): [string, string, boolean?][] {
  const vars = d.specs.map((s, i) => `${markTokens(tokenText(i + 1))} — ${variableTypeLabel(t, s.type)}${s.length ? ` · ${s.length}` : ""}`);
  return [
    [t("submitted.ref"), d.ref, true],
    ...(d.authorityRef ? ([[t("authorityRef.label"), d.authorityRef, true]] as [string, string, boolean][]) : []),
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
}

/** رسالة البريد: عنوان، فقرة، ثم ملخص الطلب في جدول. */
function render(locale: Locale, d: RequestMailData, kind: "received" | "status") {
  const t = makeT(locale);
  const dir = dirOf(locale);
  const align = dir === "rtl" ? "right" : "left";
  const status = t(`rv.${d.status}`);
  const [bg, fg] = STATUS_COLOR[d.status];

  const heading = kind === "received" ? t("mail.received.heading") : t("mail.status.heading");
  const subject =
    kind === "received"
      ? t("mail.received.subject", { ref: d.ref })
      : d.authorityRef
        ? t("mail.status.subjectAuthority", { ref: d.ref, authorityRef: d.authorityRef, status })
        : t("mail.status.subject", { ref: d.ref, status });
  const intro =
    kind === "received"
      ? [t("mail.received.body")]
      : [t("mail.status.body", { status }), t(`mail.status.${d.status}`)];

  const message = messageOf(d);
  const rows = summaryRows(t, locale, d, status);

  const reasonBlock =
    d.status === "REJECTED" && d.reason
      ? `<div style="margin:0 0 20px;padding:14px 16px;border-radius:12px;background:#fbe7e5;color:#7a1d14">
        <div style="font-size:13px;font-weight:bold;margin-bottom:6px">${e(t("mail.reason"))}</div>
        <div dir="auto" style="font-size:15px;line-height:1.8;white-space:pre-wrap;text-align:start">${e(d.reason)}</div>
      </div>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.8;color:${MAIL.muted}">${e(t("mail.rejectedHint"))}</p>`
      : "";

  const html = emailLayout(
    locale,
    `      <h1 style="margin:0 0 12px;font-size:20px">${e(heading)}</h1>
      <p style="margin:0 0 16px">
        <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${fg};font-size:13px;font-weight:bold">${e(status)}</span>
      </p>
      <table role="presentation" style="margin:0 0 18px;border-collapse:separate;border-spacing:0;border:1px solid ${MAIL.hair};border-radius:12px;font-size:14px">
        <tr>
          <td style="padding:10px 16px;color:${MAIL.muted}">${e(t("submitted.ref"))}</td>
          <td dir="ltr" style="padding:10px 16px;font-family:Consolas,monospace;font-size:16px;font-weight:bold;color:${MAIL.ink2};text-align:${align}">${e(d.ref)}</td>
        </tr>${
          d.authorityRef
            ? `
        <tr>
          <td style="padding:10px 16px;border-top:1px solid ${MAIL.hair};color:${MAIL.muted}">${e(t("authorityRef.label"))}</td>
          <td dir="ltr" style="padding:10px 16px;border-top:1px solid ${MAIL.hair};font-family:Consolas,monospace;font-size:16px;font-weight:bold;color:${MAIL.ink2};text-align:${align}">${e(d.authorityRef)}</td>
        </tr>`
            : ""
        }
      </table>
      ${intro.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:${MAIL.ink2}">${e(p)}</p>`).join("")}
      ${reasonBlock}
      <h2 style="margin:24px 0 10px;font-size:16px">${e(t("mail.summary"))}</h2>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows
          .map(
            ([label, value, ltr]) => `<tr>
          <td style="padding:8px 0;border-top:1px solid ${MAIL.hair};color:${MAIL.muted};width:38%;vertical-align:top">${e(label)}</td>
          <td ${ltr ? 'dir="ltr"' : 'dir="auto"'} style="padding:8px 0;border-top:1px solid ${MAIL.hair};vertical-align:top;white-space:pre-wrap;text-align:${align}${ltr ? ";font-family:Consolas,monospace" : ""}">${e(value)}</td>
        </tr>`,
          )
          .join("")}
      </table>
      <h2 style="margin:24px 0 10px;font-size:16px">${e(t("content.title"))}</h2>
      <div dir="auto" style="padding:14px 16px;border-radius:16px;border:1px solid #b4dfc5;background:#ffffff;font-size:15px;line-height:1.9;white-space:pre-wrap;text-align:start">${e(message || "—")}</div>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.8;color:${MAIL.subtle}">${e(t("mail.footer"))}</p>`,
  );

  const text = [
    heading,
    `${t("submitted.ref")}: ${d.ref} · ${status}`,
    ...(d.authorityRef ? [`${t("authorityRef.label")}: ${d.authorityRef}`] : []),
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

/** حد أعلى لعدد المراجع في سطر الموضوع (الباقي «+N»). */
const SUBJECT_REFS = 5;

/**
 * بريد دفعة: عدة طلبات لنفس العميل في رسالة واحدة (Kairo t7fv7wm9 — حصة البريد اليومية مشتركة).
 * كل طلب يحتفظ بكل معلومات رسالته المنفردة: الحالة، رقم الهيئة، السبب، الملخص ونص القالب.
 */
export function renderDigest(locale: Locale, kind: "received" | "status", items: RequestMailData[]) {
  if (items.length === 1) return render(locale, items[0], kind);
  const t = makeT(locale);
  const dir = dirOf(locale);
  const align = dir === "rtl" ? "right" : "left";
  const n = items.length;
  const refs = items.map((d) => d.ref);
  const refList = refs.slice(0, SUBJECT_REFS).join(", ") + (n > SUBJECT_REFS ? ` +${n - SUBJECT_REFS}` : "");
  const subject = t(kind === "received" ? "mail.digest.received.subject" : "mail.digest.status.subject", { n, refs: refList });
  const heading = t(kind === "received" ? "mail.digest.received.heading" : "mail.digest.status.heading", { n });
  const intro = t(kind === "received" ? "mail.digest.received.body" : "mail.digest.status.body", { n });

  const sections = items.map((d) => {
    const status = t(`rv.${d.status}`);
    const [bg, fg] = STATUS_COLOR[d.status];
    const rows = summaryRows(t, locale, d, status);
    const message = messageOf(d);
    const note = kind === "status" ? t(`mail.status.${d.status}`) : "";
    const reason =
      d.status === "REJECTED" && d.reason
        ? `<div style="margin:0 0 12px;padding:12px 14px;border-radius:12px;background:#fbe7e5;color:#7a1d14">
          <div style="font-size:13px;font-weight:bold;margin-bottom:4px">${e(t("mail.reason"))}</div>
          <div dir="auto" style="font-size:14px;line-height:1.8;white-space:pre-wrap;text-align:start">${e(d.reason)}</div>
        </div>`
        : "";
    const html = `
      <div style="margin:0 0 18px;padding:14px 16px;border:1px solid ${MAIL.line};border-radius:12px">
        <div style="margin:0 0 10px">
          <span dir="ltr" style="font-family:Consolas,monospace;font-size:16px;font-weight:bold;color:${MAIL.ink2}">${e(d.ref)}</span>
          <span style="display:inline-block;margin-inline-start:8px;padding:3px 10px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:bold">${e(status)}</span>
        </div>
        ${note ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.8;color:${MAIL.ink2}">${e(note)}</p>` : ""}
        ${reason}
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px">
          ${rows
            .map(
              ([label, value, ltr]) => `<tr>
            <td style="padding:6px 0;border-top:1px solid ${MAIL.hair};color:${MAIL.muted};width:38%;vertical-align:top">${e(label)}</td>
            <td ${ltr ? 'dir="ltr"' : 'dir="auto"'} style="padding:6px 0;border-top:1px solid ${MAIL.hair};vertical-align:top;white-space:pre-wrap;text-align:${align}${ltr ? ";font-family:Consolas,monospace" : ""}">${e(value)}</td>
          </tr>`,
            )
            .join("")}
        </table>
        <div style="margin:10px 0 4px;font-size:13px;color:${MAIL.muted}">${e(t("content.title"))}</div>
        <div dir="auto" style="padding:10px 12px;border-radius:12px;border:1px solid ${MAIL.line};background:#ffffff;font-size:14px;line-height:1.8;white-space:pre-wrap;text-align:start">${e(message || "—")}</div>
      </div>`;
    const text = [
      `── ${d.ref} · ${status}`,
      ...(note ? [note] : []),
      ...(d.status === "REJECTED" && d.reason ? [`${t("mail.reason")}: ${d.reason}`] : []),
      ...rows.map(([l, v]) => `${l}: ${v}`),
      `${t("content.title")}:`,
      message || "—",
    ].join("\n");
    return { html, text };
  });

  const anyRejected = items.some((d) => d.status === "REJECTED" && d.reason);
  const html = emailLayout(
    locale,
    `      <h1 style="margin:0 0 12px;font-size:20px">${e(heading)}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:${MAIL.ink2}">${e(intro)}</p>
      <p dir="ltr" style="margin:0 0 20px;font-family:Consolas,monospace;font-size:14px;color:${MAIL.ink2};text-align:${align}">${e(refs.join(", "))}</p>
      ${anyRejected ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.8;color:${MAIL.muted}">${e(t("mail.rejectedHint"))}</p>` : ""}
      ${sections.map((s) => s.html).join("")}
      <p style="margin:24px 0 0;font-size:12px;line-height:1.8;color:${MAIL.subtle}">${e(t("mail.footer"))}</p>`,
  );
  const text = [heading, "", intro, refs.join(", "), "", ...sections.map((s) => s.text + "\n"), t("mail.footer")].join("\n");
  return { subject, html, text };
}

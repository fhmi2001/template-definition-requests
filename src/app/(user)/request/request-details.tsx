import Link from "next/link";
import { AWARENESS, senderTypeDisplay, customerTypeDisplay } from "@/lib/sender-types";
import { CopyButton } from "@/components/copy-button";
import { composeMessage, exceptionLabel, tokenText, type VariableSpec, variableTypeLabel } from "@/lib/template-rules";
import { getT } from "@/i18n/server";
import { MessageBubble } from "@/components/message-bubble";
import { TemplatePreview } from "./template-preview";

function Row({ label, children, ltr }: { label: string; children: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-hair py-3 last:border-0 sm:flex-row sm:gap-6">
      <dt className="text-[13px] text-muted sm:w-40 sm:flex-none">{label}</dt>
      <dd dir={ltr ? "ltr" : undefined} className={`min-w-0 whitespace-pre-wrap break-words text-[15px] leading-7 ${ltr ? "font-mono" : ""}`}>
        {children}
      </dd>
    </div>
  );
}

function Section({
  id,
  title,
  edit,
  action,
  children,
}: {
  id: string;
  title: string;
  edit?: { href: string; label: string }[];
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1 rounded-2xl border border-line bg-white px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-bold">
          {title}
        </h2>
        {action}
      </div>
      {children}
      {edit?.length ? (
        <div className="flex flex-wrap gap-5 pt-1">
          {edit.map((e) => (
            <Link key={e.href} href={e.href} className="inline-flex min-h-11 sm:min-h-9 items-center text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
              {e.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

type RequestView = {
  senderName: string;
  senderClientName: string | null;
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
  pledge: { fileName: string; href: string } | null;
};

/** عرض كامل للطلب (للمراجعة قبل التقديم، ولصفحة التأكيد بعده). */
export async function RequestDetails({
  r,
  edit,
  copyable,
}: {
  r: RequestView;
  edit?: { sender: string; type: string; template: string; content: string };
  /** زر لنسخ نص القالب كاملاً (مع السطر الثابت) — في صفحة الإدارة */
  copyable?: boolean;
}) {
  const { t } = await getT();
  return (
    <>
      <Section
        id="d-sender"
        title={t("details.sender")}
        edit={edit ? [{ href: edit.sender, label: t("details.editSender") }, { href: edit.type, label: t("details.editType") }] : undefined}
      >
        <dl className="flex flex-col">
          <Row label={t("col.senderName")} ltr>
            {r.senderName}
          </Row>
          <Row label={t("col.clientName")}>{r.senderClientName ?? "—"}</Row>
          <Row label={t("col.senderType")}>{r.senderType ? senderTypeDisplay(t, r.senderType) : "—"}</Row>
          {r.senderType === AWARENESS ? <Row label="Client Name">{r.awarenessClientName}</Row> : null}
          <Row label="Customer Type">{r.customerType ? customerTypeDisplay(t, r.customerType) : t("details.ctUnknown")}</Row>
        </dl>
      </Section>

      <Section id="d-template" title={t("details.template")} edit={edit ? [{ href: edit.template, label: t("details.editTemplate") }] : undefined}>
        <dl className="flex flex-col">
          <Row label={t("template.name")}>{r.templateName}</Row>
          <Row label={t("template.description")}>{r.templateDescription}</Row>
        </dl>
      </Section>

      <Section
        id="d-content"
        title={t("content.title")}
        edit={edit ? [{ href: edit.content, label: t("details.editContent") }] : undefined}
        action={copyable ? <CopyButton text={composeMessage((r.content ?? "").replace(/\s+$/, ""), r.signature)} /> : undefined}
      >
        <div className="my-2 rounded-xl bg-canvas px-4 py-5">
          <MessageBubble sender={r.senderName}>
            <TemplatePreview text={(r.content ?? "").replace(/\s+$/, "")} specs={r.specs} signature={r.signature} />
          </MessageBubble>
        </div>
        {r.specs.length ? (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("details.variable")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("details.type")}</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">{t("content.maxLen")}</th>
                </tr>
              </thead>
              <tbody>
                {r.specs.map((s, i) => (
                  <tr key={i} className="border-b border-hair last:border-0">
                    <td dir="ltr" className="px-4 py-2.5 font-mono">{tokenText(i + 1)}</td>
                    <td className="px-4 py-2.5">{variableTypeLabel(t, s.type)}</td>
                    <td dir="ltr" className="px-4 py-2.5 font-mono">{s.length ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">{t("details.noVars")}</p>
        )}
        {r.exceptions.length ? (
          <dl className="mt-2 flex flex-col">
            <Row label={t("details.exceptions")}>{r.exceptions.map((e) => exceptionLabel(t, e)).join(t("common.listSep"))}</Row>
            <Row label={t("content.pledgeTitle")}>
              {r.pledge ? (
                <a href={r.pledge.href} dir="auto" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                  {r.pledge.fileName}
                </a>
              ) : (
                t("details.pledgeNotUploaded")
              )}
            </Row>
          </dl>
        ) : null}
      </Section>
    </>
  );
}

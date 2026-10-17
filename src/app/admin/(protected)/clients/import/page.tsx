import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { HEADER_ALIASES } from "@/server/client-import/read-clients";
import { PREVIEW_TTL_MS, type StoredResult } from "@/server/client-import/apply";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ClientsUploadForm } from "./upload-form";
import type { MessageKey } from "@/i18n/translate";
import { buttonClass } from "@/components/button-styles";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("ci.title") };
}

const COLUMNS: { key: "name" | "email" | "sender"; required: boolean; note: MessageKey }[] = [
  { key: "name", required: true, note: "ci.col.nameNote" },
  { key: "email", required: true, note: "ci.col.emailNote" },
  { key: "sender", required: false, note: "ci.col.senderNote" },
];

async function StatusBadge({ status, expired }: { status: "PREVIEW" | "APPLIED" | "CANCELLED"; expired: boolean }) {
  const { t } = await getT();
  const map: Record<typeof status, [MessageKey, string]> = {
    APPLIED: ["ci.st.applied", "bg-brand-50 text-brand-700"],
    CANCELLED: ["ci.st.cancelled", "bg-chip text-ink-2"],
    PREVIEW: expired ? ["ci.st.expired", "bg-chip text-ink-2"] : ["ci.st.pending", "bg-warn-50 text-warn-700"],
  };
  const [label, cls] = map[status];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${cls}`}>{t(label)}</span>;
}

export default async function ClientsImportPage() {
  await requireAdmin();
  const { t, locale } = await getT();
  const recent = await db.clientImport.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, fileName: true, status: true, createdAt: true, totalRows: true, result: true, uploadedBy: { select: { username: true } } },
  });
  const now = Date.now();

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="text-[13px] text-muted">
          <Link href="/admin/clients" className="text-brand-600 underline-offset-4 hover:underline">
            {t("clients.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span> {t("clients.importBtn")}
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("ci.heading")}</h1>
          <p className="text-sm leading-6 text-muted">
            {t("ci.intro")}
          </p>
        </div>
      </div>

      <section aria-labelledby="format-title" className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="format-title" className="text-lg font-bold">
            {t("ci.columns")}
          </h2>
          <a
            href="/admin/clients/import/template.xlsx"
            className={buttonClass("secondary", "sm")}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M4 19h16" />
            </svg>
            {t("ci.downloadTemplate")}
          </a>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.column")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.required")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("clients.notes")}</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.key} className="border-b border-hair align-top last:border-0">
                  <td className="px-4 py-3">
                    <div dir="ltr" className="font-mono font-medium">
                      {HEADER_ALIASES[c.key][0]}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">{t("ci.or")} {HEADER_ALIASES[c.key].find((a) => /[؀-ۿ]/.test(a))}</div>
                  </td>
                  <td className="px-4 py-3">{c.required ? t("common.yes") : <span className="text-muted">{t("ci.optional")}</span>}</td>
                  <td className="px-4 py-3 leading-6 text-ink-2">{t(c.note)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="flex list-disc flex-col gap-1.5 ps-5 text-[13px] leading-6 text-muted">
          <li>{t("ci.rule1")}</li>
          <li>{t("ci.rule2")}</li>
          <li>{t("ci.rule3")}</li>
          <li>{t("ci.rule4")}</li>
        </ul>
      </section>

      <section aria-labelledby="upload-title" className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
        <h2 id="upload-title" className="text-lg font-bold">
          {t("ci.upload")}
        </h2>
        <ClientsUploadForm />
      </section>

      {recent.length ? (
        <section aria-labelledby="recent-title" className="flex flex-col gap-3">
          <h2 id="recent-title" className="text-lg font-bold">
            {t("ci.recent")}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                  <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.file")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.date")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.rows")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.result")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const totals = (r.result as StoredResult | null)?.totals;
                  return (
                    <tr key={r.id} className="border-b border-hair last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/admin/clients/import/${r.id}`} dir="ltr" className="break-all font-mono text-[13px] text-brand-600 underline-offset-4 hover:underline">
                          {r.fileName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">
                        {formatDateTime(r.createdAt, locale)} · <span dir="ltr">{r.uploadedBy.username}</span>
                      </td>
                      <td dir="ltr" className="px-4 py-3 font-mono">{formatNumber(r.totalRows)}</td>
                      <td className="px-4 py-3 text-[13px] text-ink-2">
                        {totals ? t("ci.resultLine", { created: formatNumber(totals.create), updated: formatNumber(totals.update) }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} expired={now - r.createdAt.getTime() > PREVIEW_TTL_MS} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

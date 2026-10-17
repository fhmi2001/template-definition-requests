import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ImportStatusChip } from "./status-chip";
import { UploadForm } from "./upload-form";
import type { MessageKey } from "@/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("imports.title") };
}

const RULES: MessageKey[] = ["imports.rule1", "imports.rule2", "imports.rule3", "imports.rule4", "imports.rule5", "imports.rule6"];

/** النص بين [ ] اسم عمود أو قيمة من الملف: يُعرض بالإنجليزية كما هو. */
const rich = (text: string) =>
  text.split(/\[(.+?)\]/).map((part, i) =>
    i % 2 ? (
      <b key={i} dir="ltr" className="font-mono font-semibold">
        {part}
      </b>
    ) : (
      part
    ),
  );

const READ_COLUMNS = [
  "Request Id",
  "Sender Name",
  "Client Name",
  "Request Date",
  "Expiry Date",
  "Status",
  "Sender Expiry Date",
  "Sender Type",
  "Customer Type",
  "Enterprise Unified Number",
  "Cr Number",
  "Representative Name",
  "Representative Email",
  "Representative Mobile",
];

export default async function ImportsPage() {
  await requireAdmin();
  const { t, locale } = await getT();
  const batches = await db.importBatch.findMany({
    orderBy: { startedAt: "desc" },
    take: 25,
    include: { uploadedBy: { select: { username: true } } },
  });

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold">{t("imports.title")}</h1>
        <p className="text-sm leading-6 text-muted">{t("imports.intro")}</p>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="upload-title" className="flex min-w-0 flex-[2_1_440px] flex-col gap-4 rounded-2xl border border-line bg-white p-6">
          <h2 id="upload-title" className="text-lg font-bold">
            {t("imports.uploadTitle")}
          </h2>
          <UploadForm />
        </section>

        <aside aria-labelledby="rules-title" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-2xl border border-line bg-white p-6">
          <h2 id="rules-title" className="text-lg font-bold">
            {t("imports.rulesTitle")}
          </h2>
          <ul className="flex list-disc flex-col gap-2.5 ps-5 text-sm leading-6 text-[#3f4945]">
            {RULES.map((r, i) => (
              <li key={i}>{rich(t(r))}</li>
            ))}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-brand-600">{t("imports.readColumns", { n: READ_COLUMNS.length })}</summary>
            <div dir="ltr" className={`mt-3 flex flex-wrap gap-1.5 ${locale === "ar" ? "justify-end" : ""}`}>
              {READ_COLUMNS.map((c) => (
                <span key={c} className="rounded-md bg-[#e9ece8] px-2 py-0.5 font-mono text-xs">
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-muted">{t("imports.otherIgnored")}</p>
          </details>
        </aside>
      </div>

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="text-lg font-bold">
          {t("imports.history")}
        </h2>
        {batches.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center text-sm text-muted">{t("imports.none")}</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-start text-[13px] text-[#3f4945]">
                  <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.file")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.date")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("imports.th.by")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("imports.th.paid")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("ci.ps.create")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("imports.th.updated")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("imports.th.disabled")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">{t("imports.report")}</span></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const done = b.status === "COMPLETED" || b.status === "COMPLETED_WITH_ERRORS";
                  return (
                    <tr key={b.id} className="border-b border-[#eceeeb] last:border-0">
                      <td dir="ltr" className="max-w-[260px] truncate px-4 py-3 font-mono text-[13px]" title={b.fileName}>
                        {b.fileName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">{formatDateTime(b.startedAt, locale)}</td>
                      <td dir="ltr" className="px-4 py-3 font-mono text-[13px]">{b.uploadedBy.username}</td>
                      <td dir="ltr" className="px-4 py-3 font-mono">{done ? formatNumber(b.paidRows) : "—"}</td>
                      <td dir="ltr" className="px-4 py-3 font-mono">{done ? formatNumber(b.insertedCount) : "—"}</td>
                      <td dir="ltr" className="px-4 py-3 font-mono">{done ? formatNumber(b.updatedCount) : "—"}</td>
                      <td dir="ltr" className="px-4 py-3 font-mono">{done ? formatNumber(b.missingCount) : "—"}</td>
                      <td className="px-4 py-3"><ImportStatusChip status={b.status} /></td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/imports/${b.id}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                          {t("imports.report")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

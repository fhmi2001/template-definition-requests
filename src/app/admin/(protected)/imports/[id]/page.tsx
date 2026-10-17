import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { uuidSchema } from "@/lib/validation";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Alert } from "@/components/ui";
import { ImportStatusChip } from "../status-chip";
import { AutoRefresh } from "./auto-refresh";
import { translateStored } from "@/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("ir.report.title") };
}

const SHOWN_ISSUES = 300;
type Filter = "all" | "errors" | "warnings";

function Tile({ label, value, note, tone }: { label: string; value: number; note?: string; tone?: "brand" | "warn" | "danger" }) {
  const color = tone === "brand" ? "text-brand-600" : tone === "warn" ? "text-warn-700" : tone === "danger" ? "text-danger-700" : "";
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span dir="ltr" className={`font-mono text-[28px] font-medium ${color}`}>
        {formatNumber(value)}
      </span>
      {note ? <span className="text-xs leading-5 text-muted">{note}</span> : null}
    </div>
  );
}

export default async function ImportReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  await requireAdmin();
  const { t, locale } = await getT();
  const parsed = uuidSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const id = parsed.data;
  const f = (await searchParams).f;
  const filter: Filter = f === "errors" || f === "warnings" ? f : "all";

  const batch = await db.importBatch.findUnique({ where: { id }, include: { uploadedBy: { select: { username: true } } } });
  if (!batch) notFound();

  const running = batch.status === "PENDING" || batch.status === "PROCESSING";
  const done = batch.status === "COMPLETED" || batch.status === "COMPLETED_WITH_ERRORS";

  const issueWhere: Prisma.ImportIssueWhereInput = {
    importId: id,
    ...(filter === "errors" ? { severity: "ERROR" } : filter === "warnings" ? { severity: "WARNING" } : {}),
  };
  const [issues, errorCount, warningRows, sameFile] = await Promise.all([
    done ? db.importIssue.findMany({ where: issueWhere, orderBy: [{ rowNumber: "asc" }, { id: "asc" }], take: SHOWN_ISSUES }) : [],
    done ? db.importIssue.count({ where: { importId: id, severity: "ERROR" } }) : 0,
    done ? db.importIssue.count({ where: { importId: id, severity: "WARNING" } }) : 0,
    db.importBatch.findFirst({
      where: { fileSha256: batch.fileSha256, id: { not: id }, startedAt: { lt: batch.startedAt }, status: { in: ["COMPLETED", "COMPLETED_WITH_ERRORS"] } },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true },
    }),
  ]);
  const shownTotal = filter === "errors" ? errorCount : filter === "warnings" ? warningRows : errorCount + warningRows;

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("common.all"), count: errorCount + warningRows },
    { key: "errors", label: t("ci.tile.errors"), count: errorCount },
    { key: "warnings", label: t("ir.tile.warnings"), count: warningRows },
  ];

  return (
    <div className="flex flex-col gap-7">
      {running ? <AutoRefresh /> : null}

      <div className="flex flex-col gap-3">
        <div className="text-[13px] text-muted">
          <Link href="/admin/imports" className="text-brand-600 underline-offset-4 hover:underline">
            {t("imports.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span> {t("ir.crumb")}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 dir="ltr" className="break-all font-mono text-2xl font-medium">
              {batch.fileName}
            </h1>
            <p className="text-sm text-muted">
              {formatDateTime(batch.startedAt, locale)} · {t("ir.byUser")} <span dir="ltr">{batch.uploadedBy.username}</span> ·{" "}
              <span dir="ltr">{formatNumber(Math.max(1, Math.round(batch.fileSize / 1024)))} KB</span>
              {batch.sheetName ? <> · {t("ci.sheet")} <span dir="ltr">{batch.sheetName}</span></> : null}
            </p>
          </div>
          <ImportStatusChip status={batch.status} />
        </div>
      </div>

      {running ? (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-white px-6 py-8 text-[15px]">
          <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          {t("ir.running.note")}
        </div>
      ) : null}

      {batch.status === "FAILED" ? <Alert>{batch.errorMessage ? translateStored(locale, batch.errorMessage) : t("ir.failed")}</Alert> : null}

      {sameFile ? (
        <Alert tone="info">
          {t("ir.sameFile", { date: formatDateTime(sameFile.startedAt, locale) })}{" "}
          <Link href={`/admin/imports/${sameFile.id}`} className="font-semibold text-brand-600 underline">
            {t("ir.viewThat")}
          </Link>
        </Alert>
      ) : null}

      {done ? (
        <>
          <section aria-label={t("ir.fileSummary")} className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-[#3f4945]">{t("ci.th.file")}</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              <Tile label={t("ir.tile.allRows")} value={batch.totalRows} />
              <Tile label={t("imports.th.paid")} value={batch.paidRows} note={t("ir.tile.ignored", { n: formatNumber(batch.totalRows - batch.paidRows) })} />
              <Tile label={t("ir.tile.dups")} value={batch.duplicateCount} note={t("ir.tile.dupsNote")} />
              <Tile label={t("ir.tile.rejected")} value={batch.failedCount} tone={batch.failedCount ? "danger" : undefined} />
              <Tile label={t("ir.tile.warnings")} value={batch.warningCount} tone={batch.warningCount ? "warn" : undefined} note={t("ir.tile.warningsNote")} />
            </div>
          </section>

          <section aria-label={t("ir.result")} className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-[#3f4945]">{t("senders.title")}</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              <Tile label={t("ir.tile.new")} value={batch.insertedCount} tone="brand" />
              <Tile label={t("ir.tile.updated")} value={batch.updatedCount} />
              <Tile label={t("ci.ps.unchanged")} value={batch.unchangedCount} />
              <Tile label={t("ir.tile.missing")} value={batch.missingCount} tone={batch.missingCount ? "warn" : undefined} />
              <Tile label={t("ir.tile.restored")} value={batch.restoredCount} />
            </div>
            {batch.missingSkipped ? (
              <Alert tone="warning">
                {t("ir.missingSkippedNote")}
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/admin/senders" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                {t("ir.viewSenders")}
              </Link>
              {batch.missingCount ? (
                <Link href="/admin/senders?status=missing" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                  {t("ir.viewMissing")}
                </Link>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="issues-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="issues-title" className="text-lg font-bold">
                {t("ir.rowNotes")}
              </h2>
              <nav aria-label={t("ir.filterNotes")} className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.key === "all" ? `/admin/imports/${id}` : `/admin/imports/${id}?f=${tab.key}`}
                    aria-current={filter === tab.key ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] ${
                      filter === tab.key ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-[#c9cfc9] bg-white text-ink"
                    }`}
                  >
                    {tab.label}
                    <span dir="ltr" className="font-mono">
                      {formatNumber(tab.count)}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>

            {issues.length === 0 ? (
              <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center text-sm text-muted">
                {filter === "errors" ? t("ir.noErrors") : t("ir.noNotes")}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line bg-canvas text-start text-[13px] text-[#3f4945]">
                        <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.row")}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Request Id</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.column")}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{t("details.type")}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.note")}</th>
                        <th scope="col" className="px-4 py-3 font-semibold">{t("ir.th.fileValue")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((i) => (
                        <tr key={String(i.id)} className="border-b border-[#eceeeb] last:border-0">
                          <td dir="ltr" className="px-4 py-2.5 font-mono">{i.rowNumber || "—"}</td>
                          <td dir="ltr" className="px-4 py-2.5 font-mono text-[13px]">{i.requestId ?? "—"}</td>
                          <td dir="ltr" className="px-4 py-2.5 font-mono text-[13px]">{i.column ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            {i.severity === "ERROR" ? (
                              <span className="rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-semibold text-danger-700">{t("ir.sev.error")}</span>
                            ) : (
                              <span className="rounded-full bg-warn-50 px-2.5 py-0.5 text-xs font-semibold text-warn-700">{t("ir.sev.warning")}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 leading-6 text-[#3f4945]">{translateStored(locale, i.message)}</td>
                          <td className="break-all px-4 py-2.5 font-mono text-[13px]">{i.rawValue ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
                  <span>
                    {t("ir.showing", { shown: formatNumber(issues.length), total: formatNumber(shownTotal) })}
                  </span>
                  <a
                    href={`/admin/imports/${id}/issues.csv`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-field bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas"
                  >
                    {t("ir.downloadCsv")}
                  </a>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

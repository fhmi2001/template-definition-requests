import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { buildPlan, type Plan, type PlanClient, type PlanStatus } from "@/server/client-import/plan";
import { PREVIEW_TTL_MS, type StoredResult } from "@/server/client-import/apply";
import type { FileIssue, ParsedClient } from "@/server/client-import/read-clients";
import { uuidSchema } from "@/lib/validation";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Alert } from "@/components/ui";
import { ImportDecision } from "./decision";
import { translateStored, type MessageKey, type T } from "@/i18n/translate";
import { FilterChips } from "@/components/list-controls";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("ci.preview.title") };
}

const SHOWN = 500;
const ARABIC = /[\u0600-\u06FF]/;
const FILTERS = ["all", "create", "update", "unchanged", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TEXT: Record<PlanStatus, { preview: MessageKey; done: MessageKey; cls: string }> = {
  create: { preview: "ci.ps.create", done: "ci.ps.created", cls: "bg-brand-50 text-brand-600" },
  update: { preview: "ci.ps.update", done: "ci.ps.updated", cls: "bg-info-50 text-info-700" },
  unchanged: { preview: "ci.ps.unchanged", done: "ci.ps.unchanged", cls: "bg-chip text-ink-2" },
  rejected: { preview: "ci.ps.rejected", done: "ci.ps.rejected", cls: "bg-danger-50 text-danger-700" },
};

function Tile({ label, value, tone }: { label: string; value: number; tone?: "brand" | "danger" }) {
  const color = tone === "brand" ? "text-brand-600" : tone === "danger" ? "text-danger-700" : "";
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-4">
      <span className="text-[13px] leading-5 text-muted">{label}</span>
      <span dir="ltr" className={`font-mono text-[28px] font-medium ${color}`}>
        {formatNumber(value)}
      </span>
    </div>
  );
}

const rowsText = (t: T, rows: number[]) =>
  rows.length > 4
    ? t("ci.rowsMore", { list: rows.slice(0, 3), more: formatNumber(rows.length - 3) })
    : t(rows.length > 1 ? "ci.rows" : "ci.row", { list: rows });

async function ClientRow({ c, done }: { c: PlanClient; done: boolean }) {
  const { t } = await getT();
  const st = STATUS_TEXT[c.status];
  const showAdds = c.status === "create" || c.status === "update";
  return (
    <tr className="border-b border-hair align-top last:border-0">
      <td className="px-4 py-3">
        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${st.cls}`}>{t(done ? st.done : st.preview)}</span>
      </td>
      <td className="px-4 py-3">
        {c.clientId && (done || c.status !== "create") ? (
          <Link href={`/admin/clients/${c.clientId}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
            {c.name}
          </Link>
        ) : (
          <span className="font-semibold">{c.name}</span>
        )}
        <div className="mt-0.5 text-[12px] text-muted">
          {rowsText(t, c.rows)}
          {c.clientId && c.status !== "create" ? t("ci.existingClient") : ""}
          {c.clientActive === false ? t("ci.disabledSuffix") : ""}
        </div>
      </td>
      <td className="px-4 py-3">
        {showAdds && c.addEmails.length ? (
          <ul className="flex flex-col gap-0.5">
            {c.addEmails.map((e) => (
              <li key={e} dir="ltr" className="font-mono text-[12.5px]">
                {e}
              </li>
            ))}
          </ul>
        ) : null}
        {c.keptEmails.length ? <div className="mt-0.5 text-[12px] text-muted">{t("ci.keptEmails", { n: formatNumber(c.keptEmails.length) })}</div> : null}
        {!(showAdds && c.addEmails.length) && !c.keptEmails.length ? <span className="text-muted">—</span> : null}
      </td>
      <td className="px-4 py-3">
        {showAdds && c.addSenders.length ? (
          <ul className="flex flex-wrap gap-1">
            {c.addSenders.map((s) => (
              <li key={s.id} dir="ltr" className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[12.5px] text-brand-700">
                {s.name}
              </li>
            ))}
          </ul>
        ) : null}
        {c.keptSenders.length ? <div className="mt-0.5 text-[12px] text-muted">{t("ci.keptSenders", { n: formatNumber(c.keptSenders.length) })}</div> : null}
        {!(showAdds && c.addSenders.length) && !c.keptSenders.length ? <span className="text-muted">—</span> : null}
      </td>
      <td dir="ltr" className="px-4 py-3 font-mono">
        {c.status === "rejected" ? (
          <span className="text-muted">—</span>
        ) : c.visibleSenders === 0 ? (
          <span className="text-warn-700" title={t("ci.noVisible")}>0</span>
        ) : (
          formatNumber(c.visibleSenders)
        )}
      </td>
    </tr>
  );
}

export default async function ClientImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  await requireAdmin();
  const { t, locale } = await getT();
  const parsedId = uuidSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();
  const id = parsedId.data;
  const f = (await searchParams).f;
  const filter: Filter = FILTERS.includes(f as Filter) ? (f as Filter) : "all";

  const imp = await db.clientImport.findUnique({ where: { id }, include: { uploadedBy: { select: { username: true } } } });
  if (!imp) notFound();

  const expired = imp.status === "PREVIEW" && Date.now() - imp.createdAt.getTime() > PREVIEW_TTL_MS;
  const done = imp.status === "APPLIED";
  let plan: Plan | null = null;
  let fileIssues: FileIssue[] = [];
  if (done && imp.result) {
    const stored = imp.result as unknown as StoredResult;
    plan = stored;
    fileIssues = stored.fileIssues;
  } else if (imp.status === "PREVIEW" && !expired) {
    plan = await buildPlan(imp.parsed as unknown as ParsedClient[], db);
    fileIssues = imp.fileIssues as unknown as FileIssue[];
  }

  const issues = plan ? [...fileIssues, ...plan.problems].sort((a, b) => a.row - b.row) : [];
  const errors = issues.filter((i) => i.severity === "ERROR").length;
  const clients = plan ? (filter === "all" ? plan.clients : plan.clients.filter((c) => c.status === filter)) : [];
  const totals = plan?.totals;
  const canApply = !!totals && totals.create + totals.update > 0;
  const confirmMessage = totals
    ? t("ci.confirmMessage", {
        create: formatNumber(totals.create),
        update: formatNumber(totals.update),
        emails: formatNumber(totals.emails),
        senders: formatNumber(totals.senders),
      })
    : "";

  const tabLabel: Record<Filter, string> = {
    all: t("common.all"),
    create: t(done ? "ci.ps.created" : "ci.ps.create"),
    update: t(done ? "ci.ps.updated" : "ci.ps.update"),
    unchanged: t("ci.ps.unchanged"),
    rejected: t("ci.ps.rejected"),
  };
  const tabCount = (k: Filter) => (!plan ? 0 : k === "all" ? plan.clients.length : plan.totals[k]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="text-[13px] text-muted">
          <Link href="/admin/clients" className="text-brand-600 underline-offset-4 hover:underline">
            {t("clients.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span>{" "}
          <Link href="/admin/clients/import" className="text-brand-600 underline-offset-4 hover:underline">
            {t("clients.importBtn")}
          </Link>{" "}
          <span aria-hidden="true">/</span> {done ? t("ci.crumbResult") : t("ci.crumbPreview")}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 dir="ltr" className="break-all font-mono text-2xl font-medium">
            {imp.fileName}
          </h1>
          <p className="text-sm text-muted">
            {t("ci.uploadedLine", { date: formatDateTime(imp.createdAt, locale) })} <span dir="ltr">{imp.uploadedBy.username}</span> ·{" "}
            {t("ci.rowsCount", { n: formatNumber(imp.totalRows) })}
            {imp.sheetName ? <> · {t("ci.sheet")} <span dir="ltr">{imp.sheetName}</span></> : null}
          </p>
        </div>
      </div>

      {imp.status === "CANCELLED" ? (
        <Alert tone="info">
          {t("ci.cancelledNote")}{" "}
          <Link href="/admin/clients/import" className="font-semibold text-brand-600 underline">
            {t("ci.uploadNew")}
          </Link>
        </Alert>
      ) : null}
      {expired ? (
        <Alert tone="warning">
          {t("ci.expiredNote")}{" "}
          <Link href="/admin/clients/import" className="font-semibold text-brand-600 underline">
            {t("ci.reupload")}
          </Link>{" "}
          {t("ci.reuploadTail")}
        </Alert>
      ) : null}
      {done ? (
        <Alert tone="success">
          {t("ci.doneNote", { date: imp.finishedAt ? formatDateTime(imp.finishedAt, locale) : "" })}
        </Alert>
      ) : null}

      {plan && totals ? (
        <>
          {!done ? (
            <section aria-label={t("ci.decision")} className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-5">
              <p className="text-[15px] leading-7">
                {canApply ? (
                  <>
                    <strong>{t("ci.previewOnly")}</strong> {t("ci.previewOnlyTail")}
                  </>
                ) : (
                  <strong>{t("ci.nothingToAdd")}</strong>
                )}
              </p>
              <ImportDecision importId={imp.id} confirmMessage={confirmMessage} canApply={canApply} />
            </section>
          ) : null}

          <section aria-label={t("ci.summaryAria")} className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <Tile label={t(done ? "ci.tile.created" : "ci.tile.new")} value={totals.create} tone="brand" />
            <Tile label={t(done ? "ci.tile.updated" : "ci.tile.toUpdate")} value={totals.update} />
            <Tile label={t("ci.tile.emails")} value={totals.emails} />
            <Tile label={t(done ? "ci.tile.linked" : "ci.tile.toLink")} value={totals.senders} />
            <Tile label={t("ci.ps.unchanged")} value={totals.unchanged} />
            <Tile label={t("ci.tile.errors")} value={errors} tone={errors ? "danger" : undefined} />
          </section>

          <section aria-labelledby="clients-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="clients-title" className="text-lg font-bold">
                {t("ci.clientsInFile")}
              </h2>
              <FilterChips
                label={t("ci.filter")}
                items={FILTERS.map((k) => ({
                  key: k,
                  href: k === "all" ? `/admin/clients/import/${id}` : `/admin/clients/import/${id}?f=${k}`,
                  label: tabLabel[k],
                  count: tabCount(k),
                  active: filter === k,
                }))}
              />
            </div>
            {clients.length === 0 ? (
              <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center text-sm text-muted">{t("ci.noneInTab")}</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                      <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("col.client")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t(done ? "ci.th.addedEmails" : "ci.th.newEmails")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t(done ? "ci.th.linkedSenders" : "ci.th.toLink")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        <span title={t("ci.th.visibleHint")}>{t("ci.th.visible")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.slice(0, SHOWN).map((c) => (
                      <ClientRow key={`${c.name}-${c.rows[0]}`} c={c} done={done} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {clients.length > SHOWN ? <p className="text-[13px] text-muted">{t("ci.showingClients", { shown: formatNumber(SHOWN), total: formatNumber(clients.length) })}</p> : null}
          </section>

          <section aria-labelledby="issues-title" className="flex flex-col gap-4">
            <h2 id="issues-title" className="text-lg font-bold">
              {t("ci.issues")}
            </h2>
            {issues.length === 0 ? (
              <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center text-sm text-muted">{t("ci.noIssues")}</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                      <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.row")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.column")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("details.type")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.note")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("ci.th.value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.slice(0, SHOWN).map((i, n) => (
                      <tr key={n} className="border-b border-hair last:border-0">
                        <td dir="ltr" className="px-4 py-2.5 font-mono">{i.row || "—"}</td>
                        <td dir="ltr" className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px]">{i.column ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {i.severity === "ERROR" ? (
                            <span className="whitespace-nowrap rounded-full bg-danger-50 px-2.5 py-0.5 text-xs font-semibold text-danger-700">{t("ci.notImported")}</span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full bg-warn-50 px-2.5 py-0.5 text-xs font-semibold text-warn-700">{t("ci.warning")}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 leading-6 text-ink-2">{translateStored(locale, i.message)}</td>
                        <td
                          dir={i.value && !ARABIC.test(i.value) ? "ltr" : undefined}
                          className={`px-4 py-2.5 text-[13px] [overflow-wrap:anywhere] ${i.value && !ARABIC.test(i.value) ? "font-mono" : ""}`}
                        >
                          {i.value ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {issues.length > SHOWN ? <p className="text-[13px] text-muted">{t("ci.showing", { shown: formatNumber(SHOWN), total: formatNumber(issues.length) })}</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

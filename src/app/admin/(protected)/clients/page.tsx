import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { formatDate, formatNumber } from "@/lib/format";
import { buttonClass } from "@/components/button-styles";
import { FilterChips, Pager } from "@/components/list-controls";
import {
  CLIENTS_PAGE_SIZE,
  CLIENT_STATUSES,
  NEEDS_ATTENTION,
  buildClientWhere,
  clientFiltersQuery,
  clientOrderBy,
  clientRowSelect,
  distinct,
  hasClientFilters,
  parseClientFilters,
} from "@/server/admin-clients";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("clients.title") };
}

const field = "h-11 w-full min-w-0 rounded-xl border border-field bg-white px-3 text-small hover:border-field-strong";
const label = "text-meta font-semibold text-ink-2";
const chip = "whitespace-nowrap rounded-md bg-chip px-2 py-0.5 font-mono text-meta";

/** عدد ما لم يُعرض من القائمة. */
function More({ n }: { n: number }) {
  return n > 0 ? <li className="px-1 py-0.5 text-meta tabular-nums text-muted">+{formatNumber(n)}</li> : null;
}

const PlusIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const UploadIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
  </svg>
);
const DownloadIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
  </svg>
);

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const f = parseClientFilters(await searchParams);
  const where = buildClientWhere(f);
  const base = buildClientWhere(f, { ignoreStatus: true });

  const [clients, total, all, active, disabled, attention, anyClient] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: clientOrderBy(f),
      skip: (f.page - 1) * CLIENTS_PAGE_SIZE,
      take: CLIENTS_PAGE_SIZE,
      select: clientRowSelect,
    }),
    db.client.count({ where }),
    db.client.count({ where: base }),
    db.client.count({ where: { AND: [base, { isActive: true }] } }),
    db.client.count({ where: { AND: [base, { isActive: false }] } }),
    db.client.count({ where: { AND: [base, NEEDS_ATTENTION] } }),
    db.client.findFirst({ select: { id: true } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));
  // رابط قديم لصفحة لم تعد موجودة (بعد حذف عملاء أو تغيير فلتر): آخر صفحة فيها نتائج
  if (f.page > pages) redirect(`/admin/clients${clientFiltersQuery(f, { page: pages })}`);
  const filtered = hasClientFilters(f);
  const first = total ? (f.page - 1) * CLIENTS_PAGE_SIZE + 1 : 0;
  const last = Math.min(f.page * CLIENTS_PAGE_SIZE, total);
  const statusCount = { all, active, disabled, attention };
  const statusLabel = { all: t("common.all"), active: t("state.activeM"), disabled: t("state.disabledM"), attention: t("clients.st.attention") };
  const exportQuery = clientFiltersQuery(f, { page: 1 });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <h1 id="clients-title" className="text-page font-bold">
            {t("clients.title")}
          </h1>
          <p className="text-small text-muted">{t("clients.intro")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/clients/import" className={buttonClass("secondary")}>
            <UploadIcon />
            {t("clients.importBtn")}
          </Link>
          <Link href="/admin/clients/new" className={buttonClass("primary")}>
            <PlusIcon />
            {t("clients.add")}
          </Link>
        </div>
      </div>

      {!anyClient ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
          <h2 className="text-title font-bold">{t("clients.empty.title")}</h2>
          <p className="max-w-[460px] text-body text-muted">{t("clients.empty")}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/admin/clients/new" className={buttonClass("primary")}>
              <PlusIcon />
              {t("clients.add")}
            </Link>
            <Link href="/admin/clients/import" className={buttonClass("secondary")}>
              <UploadIcon />
              {t("clients.importBtn")}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <FilterChips
            label={t("clients.statusLabel")}
            items={(["all", ...CLIENT_STATUSES] as const).map((s) => ({
              key: s,
              href: `/admin/clients${clientFiltersQuery(f, { status: s, page: 1 })}`,
              label: statusLabel[s],
              count: statusCount[s],
              active: f.status === s,
            }))}
          />

          <form role="search" aria-label={t("clients.f.label")} className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
            {f.status !== "all" ? <input type="hidden" name="status" value={f.status} /> : null}
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
              <label htmlFor="q" className={label}>
                {t("clients.f.q")}
              </label>
              <input id="q" name="q" type="search" defaultValue={f.q} placeholder={t("clients.f.qPlaceholder")} className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="from" className={label}>
                {t("clients.f.from")}
              </label>
              <input id="from" name="from" type="date" defaultValue={f.from ?? ""} className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="to" className={label}>
                {t("clients.f.to")}
              </label>
              <input id="to" name="to" type="date" defaultValue={f.to ?? ""} className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sort" className={label}>
                {t("clients.f.sort")}
              </label>
              <select id="sort" name="sort" defaultValue={f.sort} className={field}>
                <option value="newest">{t("clients.f.newest")}</option>
                <option value="oldest">{t("clients.f.oldest")}</option>
                <option value="name">{t("clients.f.name")}</option>
                <option value="requests">{t("clients.f.requests")}</option>
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-1">
              <button type="submit" className={buttonClass("secondary")}>
                {t("clients.f.apply")}
              </button>
              {filtered ? (
                <Link href="/admin/clients" className="inline-flex min-h-11 items-center px-1 text-small font-semibold text-brand-700 underline-offset-4 hover:underline">
                  {t("clients.f.reset")}
                </Link>
              ) : null}
            </div>
          </form>

          <section aria-labelledby="clients-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-small tabular-nums text-muted">
                {t("clients.showing", { from: formatNumber(first), to: formatNumber(last), total: formatNumber(total) })}
              </p>
              {total ? (
                <div role="group" aria-label={t("clients.export.label")} className="flex flex-wrap gap-2">
                  <a href={`/admin/clients/export.csv${exportQuery}`} className={buttonClass("secondary", "sm")}>
                    <DownloadIcon />
                    {t("clients.export.csv")}
                  </a>
                  <a href={`/admin/clients/export.xlsx${exportQuery}`} className={buttonClass("secondary", "sm")}>
                    <DownloadIcon />
                    {t("clients.export.xlsx")}
                  </a>
                </div>
              ) : null}
            </div>

            {clients.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-6 py-14 text-center">
                <h2 className="text-title font-bold">{t("clients.noMatch.title")}</h2>
                <p className="max-w-[460px] text-body text-muted">{t("clients.noMatch.body")}</p>
                <Link href="/admin/clients" className="mt-1 inline-flex min-h-11 items-center text-small font-semibold text-brand-700 underline-offset-4 hover:underline">
                  {t("clients.f.reset")}
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                <table aria-labelledby="clients-title" className="w-full min-w-[1080px] border-collapse text-small">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-meta text-ink-2">
                      <th scope="col" className="px-4 py-3 font-semibold">{t("col.client")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("clients.emails")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("col.senders")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("ent.cr")}</th>
                      <th scope="col" className="px-4 py-3 text-end font-semibold">{t("clients.th.requests")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("col.addedOn")}</th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        <span className="sr-only">{t("common.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => {
                      const activeEmails = c.users.filter((u) => u.isActive).length;
                      const crs = distinct(c.senders.map((s) => s.crNumber));
                      const problems = c.isActive
                        ? [activeEmails === 0 ? t("clients.attention.noEmail") : null, c.senders.length === 0 ? t("clients.attention.noSenders") : null].filter(Boolean)
                        : [];
                      return (
                        <tr key={c.id} className="border-b border-hair align-top transition-colors last:border-0 hover:bg-canvas-2">
                          <td className="max-w-[280px] px-4 py-3.5">
                            <Link href={`/admin/clients/${c.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                              {c.name}
                            </Link>
                            {c.notes ? <div className="mt-1 text-meta text-muted">{c.notes}</div> : null}
                            {problems.length ? (
                              <div className="mt-2 inline-flex rounded-md bg-warn-50 px-2 py-0.5 text-meta font-semibold text-warn-700">
                                {problems.join(t("common.listSep"))}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3.5">
                            {c.users.length === 0 ? (
                              <span className="text-meta text-muted">—</span>
                            ) : (
                              <ul className="flex flex-col items-start gap-1.5">
                                {c.users.slice(0, 2).map((u) => (
                                  <li
                                    key={u.id}
                                    dir="ltr"
                                    className={u.isActive ? chip : "whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-meta text-subtle line-through"}
                                    title={u.isActive ? undefined : t("state.disabledM")}
                                  >
                                    {u.email}
                                  </li>
                                ))}
                                <More n={c.users.length - 2} />
                              </ul>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {c.senders.length === 0 ? (
                              <span className="text-meta text-muted">—</span>
                            ) : (
                              <ul className="flex max-w-[240px] flex-wrap gap-1.5">
                                {c.senders.slice(0, 4).map((s) => (
                                  <li key={s.id} dir="ltr" className={chip}>
                                    {s.name}
                                  </li>
                                ))}
                                <More n={c.senders.length - 4} />
                              </ul>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {crs.length === 0 ? (
                              <span className="text-meta text-muted">—</span>
                            ) : (
                              <ul className="flex flex-col items-start gap-1">
                                {crs.slice(0, 2).map((cr) => (
                                  <li key={cr} dir="ltr" className="font-mono text-meta text-ink">
                                    {cr}
                                  </li>
                                ))}
                                <More n={crs.length - 2} />
                              </ul>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-end font-mono tabular-nums">{formatNumber(c._count.requests)}</td>
                          <td className="px-4 py-3.5">
                            {c.isActive ? (
                              <span className="inline-flex whitespace-nowrap rounded-full bg-brand-50 px-2.5 py-1 text-meta font-semibold text-brand-700">{t("state.activeM")}</span>
                            ) : (
                              <span className="inline-flex whitespace-nowrap rounded-full bg-chip px-2.5 py-1 text-meta font-semibold text-ink-2">{t("state.disabledM")}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-meta tabular-nums text-muted">{formatDate(c.createdAt, locale)}</td>
                          <td className="px-4 py-3.5">
                            <Link href={`/admin/clients/${c.id}`} className="inline-flex min-h-9 items-center font-semibold text-brand-700 underline-offset-4 hover:underline">
                              {t("common.manage")}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pages > 1 ? (
              <Pager
                summary={t("clients.pager", { page: formatNumber(f.page), pages: formatNumber(pages) })}
                prevHref={f.page > 1 ? `/admin/clients${clientFiltersQuery(f, { page: f.page - 1 })}` : null}
                nextHref={f.page < pages ? `/admin/clients${clientFiltersQuery(f, { page: f.page + 1 })}` : null}
              />
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

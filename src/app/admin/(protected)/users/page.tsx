import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { db } from "@/server/db";
import { requireSuperAdmin } from "@/server/auth/dal";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { buttonClass } from "@/components/button-styles";
import { FilterChips, Pager } from "@/components/list-controls";
import {
  ADMIN_ROLES,
  USERS_PAGE_SIZE,
  adminFiltersQuery,
  adminOrderBy,
  adminRowSelect,
  buildAdminWhere,
  hasAdminFilters,
  parseAdminFilters,
} from "@/server/admin-users";
import { RoleTag, StatusChip, roleLabel } from "./user-ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("users.title") };
}

const field = "h-11 w-full min-w-0 rounded-xl border border-field bg-white px-3 text-small hover:border-field-strong";
const label = "text-meta font-semibold text-ink-2";

const PlusIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const DownloadIcon = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
  </svg>
);

/** فريق لوحة الإدارة. للمشرف الرئيسي وحده. */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { admin: me } = await requireSuperAdmin();
  const { t, locale } = await getT();
  const f = parseAdminFilters(await searchParams);
  const where = buildAdminWhere(f);
  const base = buildAdminWhere(f, { ignoreRole: true });

  const [admins, total, all, supers, regular] = await Promise.all([
    db.admin.findMany({ where, orderBy: adminOrderBy(f), skip: (f.page - 1) * USERS_PAGE_SIZE, take: USERS_PAGE_SIZE, select: adminRowSelect }),
    db.admin.count({ where }),
    db.admin.count({ where: base }),
    db.admin.count({ where: { AND: [base, { role: "SUPER_ADMIN" }] } }),
    db.admin.count({ where: { AND: [base, { role: "ADMIN" }] } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  if (f.page > pages) redirect(`/admin/users${adminFiltersQuery(f, { page: pages })}`);
  const filtered = hasAdminFilters(f);
  const first = total ? (f.page - 1) * USERS_PAGE_SIZE + 1 : 0;
  const last = Math.min(f.page * USERS_PAGE_SIZE, total);
  const counts = { all, SUPER_ADMIN: supers, ADMIN: regular };
  const exportQuery = adminFiltersQuery(f, { page: 1 });
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <h1 id="users-title" className="text-page font-bold">
            {t("users.title")}
          </h1>
          <p className="text-small text-muted">{t("users.intro")}</p>
        </div>
        <Link href="/admin/users/new" className={buttonClass("primary")}>
          <PlusIcon />
          {t("users.add")}
        </Link>
      </div>

      <FilterChips
        label={t("users.f.role")}
        items={(["all", ...ADMIN_ROLES] as const).map((r) => ({
          key: r,
          href: `/admin/users${adminFiltersQuery(f, { role: r, page: 1 })}`,
          label: r === "all" ? t("common.all") : roleLabel(t, r),
          count: counts[r],
          active: f.role === r,
        }))}
      />

      <form role="search" aria-label={t("users.f.label")} className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        {f.role !== "all" ? <input type="hidden" name="role" value={f.role} /> : null}
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <label htmlFor="q" className={label}>
            {t("clients.f.q")}
          </label>
          <input id="q" name="q" type="search" defaultValue={f.q} placeholder={t("users.f.qPlaceholder")} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className={label}>
            {t("col.status")}
          </label>
          <select id="status" name="status" defaultValue={f.status} className={field}>
            <option value="all">{t("common.all")}</option>
            <option value="active">{t("state.activeM")}</option>
            <option value="disabled">{t("state.disabledM")}</option>
          </select>
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
            <option value="name">{t("users.f.username")}</option>
            <option value="lastLogin">{t("users.f.lastLogin")}</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-5">
          <button type="submit" className={buttonClass("secondary")}>
            {t("clients.f.apply")}
          </button>
          {filtered ? (
            <Link href="/admin/users" className="inline-flex min-h-11 items-center px-1 text-small font-semibold text-brand-700 underline-offset-4 hover:underline">
              {t("clients.f.reset")}
            </Link>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="users-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-small tabular-nums text-muted">
            {t("clients.showing", { from: formatNumber(first), to: formatNumber(last), total: formatNumber(total) })}
          </p>
          {total ? (
            <div role="group" aria-label={t("clients.export.label")} className="flex flex-wrap gap-2">
              <a href={`/admin/users/export.csv${exportQuery}`} className={buttonClass("secondary", "sm")}>
                <DownloadIcon />
                {t("clients.export.csv")}
              </a>
              <a href={`/admin/users/export.xlsx${exportQuery}`} className={buttonClass("secondary", "sm")}>
                <DownloadIcon />
                {t("clients.export.xlsx")}
              </a>
            </div>
          ) : null}
        </div>

        {admins.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-6 py-14 text-center">
            <h2 className="text-title font-bold">{t("users.noMatch.title")}</h2>
            <p className="max-w-[460px] text-body text-muted">{t("clients.noMatch.body")}</p>
            <Link href="/admin/users" className="mt-1 inline-flex min-h-11 items-center text-small font-semibold text-brand-700 underline-offset-4 hover:underline">
              {t("clients.f.reset")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table aria-labelledby="users-title" className="w-full min-w-[860px] border-collapse text-small">
              <thead>
                <tr className="border-b border-line bg-canvas text-meta text-ink-2">
                  <th scope="col" className="px-4 py-3 font-semibold">{t("users.th.user")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("users.f.role")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.lastLogin")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("users.th.created")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">{t("common.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => {
                  const name = a.displayName && a.displayName !== a.username ? a.displayName : null;
                  return (
                    <tr key={a.id} className="border-b border-hair align-top transition-colors last:border-0 hover:bg-canvas-2">
                      <td className="max-w-[320px] px-4 py-3.5">
                        <Link href={`/admin/users/${a.id}/edit`} className="font-semibold text-ink underline-offset-4 hover:underline">
                          {name ?? <span dir="ltr" className="font-mono">{a.username}</span>}
                        </Link>
                        {name ? (
                          <div dir="ltr" className="mt-0.5 font-mono text-meta text-muted">
                            {a.username}
                          </div>
                        ) : null}
                        {a.email ? (
                          <div dir="ltr" className="mt-0.5 font-mono text-meta text-muted">
                            {a.email}
                          </div>
                        ) : (
                          <div className="mt-1.5 inline-flex rounded-md bg-warn-50 px-2 py-0.5 text-meta font-semibold text-warn-700">{t("users.noEmail")}</div>
                        )}
                        {a.id === me.id ? <div className="mt-0.5 text-meta text-muted">{t("users.you")}</div> : null}
                      </td>
                      <td className="px-4 py-3.5">
                        <RoleTag role={a.role} t={t} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusChip active={a.isActive} locked={!!a.lockedUntil && a.lockedUntil > now} t={t} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-meta tabular-nums text-muted">{a.lastLoginAt ? formatDateTime(a.lastLoginAt, locale) : t("users.never")}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-meta tabular-nums text-muted">{formatDate(a.createdAt, locale)}</td>
                      <td className="px-4 py-3.5">
                        <Link href={`/admin/users/${a.id}/edit`} className="inline-flex min-h-9 items-center font-semibold text-brand-700 underline-offset-4 hover:underline">
                          {t("users.edit")}
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
            prevHref={f.page > 1 ? `/admin/users${adminFiltersQuery(f, { page: f.page - 1 })}` : null}
            nextHref={f.page < pages ? `/admin/users${adminFiltersQuery(f, { page: f.page + 1 })}` : null}
          />
        ) : null}
      </section>
    </div>
  );
}

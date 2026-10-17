import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { getT } from "@/i18n/server";
import { formatDateTime, formatNumber } from "@/lib/format";
import { REVIEW_STATUSES, REVIEW_STYLE } from "@/lib/review-status";
import { SENDER_TYPES, senderTypeDisplay } from "@/lib/sender-types";
import { referenceText } from "@/server/requests";
import { CUSTOMER_TYPES, PAGE_SIZE, buildWhere, filtersQuery, hasFilters, orderBy, parseFilters } from "@/server/admin-requests";
import { customerTypeLabel } from "../senders/sender-ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("rq.title") };
}

const field = "h-11 w-full min-w-0 rounded-[10px] border border-field bg-white px-3 text-sm";
const label = "text-[13px] font-semibold text-[#3f4945]";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const f = parseFilters(await searchParams);
  const where = buildWhere(f);

  const [requests, total, byStatus, clients] = await Promise.all([
    db.templateRequest.findMany({
      where,
      orderBy: orderBy(f),
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        referenceNo: true,
        submittedAt: true,
        reviewStatus: true,
        reviewedAt: true,
        senderName: true,
        senderType: true,
        templateName: true,
        customerType: true,
        client: { select: { id: true, name: true } },
        user: { select: { email: true } },
      },
    }),
    db.templateRequest.count({ where }),
    db.templateRequest.groupBy({ by: ["reviewStatus"], where: buildWhere(f, { ignoreStatus: true }), _count: { _all: true } }),
    db.client.findMany({
      where: { requests: { some: { status: "SUBMITTED" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const counts = new Map(byStatus.map((s) => [s.reviewStatus, s._count._all]));
  const all = byStatus.reduce((sum, s) => sum + s._count._all, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = hasFilters(f);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[680px] flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("rq.title")}</h1>
          <p className="text-sm leading-6 text-muted">{t("rq.intro")}</p>
        </div>
        <a
          href={`/admin/requests/export.csv${filtersQuery(f, { page: 1 })}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-field bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
          </svg>
          {t("rq.export")}
        </a>
      </div>

      <nav aria-label={t("rq.summary")} className="flex flex-wrap gap-2">
        {(["all", ...REVIEW_STATUSES] as const).map((s) => {
          const on = f.status === s;
          return (
            <Link
              key={s}
              href={`/admin/requests${filtersQuery(f, { status: s, page: 1 })}`}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] ${
                on ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-[#c9cfc9] bg-white text-ink hover:bg-canvas"
              }`}
            >
              {s === "all" ? t("common.all") : t(`rv.${s}`)}
              <span dir="ltr" className="font-mono">
                {formatNumber(s === "all" ? all : (counts.get(s) ?? 0))}
              </span>
            </Link>
          );
        })}
      </nav>

      <form role="search" aria-label={t("rq.f.label")} className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="q" className={label}>
            {t("rq.f.q")}
          </label>
          <input id="q" name="q" type="search" defaultValue={f.q} placeholder={t("rq.f.qPlaceholder")} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className={label}>
            {t("rq.f.status")}
          </label>
          <select id="status" name="status" defaultValue={f.status} className={field}>
            <option value="all">{t("common.all")}</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`rv.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="client" className={label}>
            {t("rq.f.client")}
          </label>
          <select id="client" name="client" defaultValue={f.client ?? ""} className={field}>
            <option value="">{t("rq.f.allClients")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="senderType" className={label}>
            {t("rq.f.senderType")}
          </label>
          <select id="senderType" name="senderType" defaultValue={f.senderType ?? ""} className={field}>
            <option value="">{t("rq.f.allTypes")}</option>
            {SENDER_TYPES.map((s) => (
              <option key={s} value={s}>
                {senderTypeDisplay(t, s)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerType" className={label}>
            {t("rq.f.customerType")}
          </label>
          <select id="customerType" name="customerType" defaultValue={f.customerType ?? ""} className={field}>
            <option value="">{t("common.all")}</option>
            {CUSTOMER_TYPES.map((c) => (
              <option key={c} value={c}>
                {customerTypeLabel(t, c) === c ? c : `${customerTypeLabel(t, c)} · ${c}`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className={label}>
            {t("rq.f.from")}
          </label>
          <input id="from" name="from" type="date" defaultValue={f.from ?? ""} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className={label}>
            {t("rq.f.to")}
          </label>
          <input id="to" name="to" type="date" defaultValue={f.to ?? ""} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sort" className={label}>
            {t("rq.f.sort")}
          </label>
          <select id="sort" name="sort" defaultValue={f.sort} className={field}>
            <option value="newest">{t("rq.f.newest")}</option>
            <option value="oldest">{t("rq.f.oldest")}</option>
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="min-h-11 rounded-[10px] bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700">
            {t("rq.f.apply")}
          </button>
          {filtered ? (
            <Link href="/admin/requests" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-600 underline-offset-4 hover:underline">
              {t("rq.f.reset")}
            </Link>
          ) : null}
        </div>
      </form>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center text-sm text-muted">{filtered ? t("rq.noMatch") : t("rq.empty")}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[940px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-[13px] text-[#3f4945]">
                <th scope="col" className="px-4 py-3 font-semibold">{t("rq.th.ref")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("rq.th.submitted")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("col.client")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("col.senderName")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("template.name")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">Customer Type</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">{t("common.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-[#eceeeb] align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/admin/requests/${r.id}`} dir="ltr" className="font-mono font-semibold text-brand-600 underline-offset-4 hover:underline">
                      {referenceText(r.referenceNo)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">{formatDateTime(r.submittedAt, locale)}</td>
                  <td className="px-4 py-3 leading-6">
                    <div className="font-semibold">{r.client.name}</div>
                    {r.user ? (
                      <div dir="ltr" className="font-mono text-[12px] text-muted">
                        {r.user.email}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 leading-6">
                    <div dir="ltr" className="font-mono font-medium">
                      {r.senderName}
                    </div>
                    {r.senderType ? <div className="text-[12px] text-muted">{senderTypeDisplay(t, r.senderType)}</div> : null}
                  </td>
                  <td className="max-w-[260px] px-4 py-3 leading-6">
                    <div className="break-words">{r.templateName ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">{r.customerType ? customerTypeLabel(t, r.customerType) : "—"}</td>
                  <td className="px-4 py-3">
                    {r.reviewStatus ? (
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${REVIEW_STYLE[r.reviewStatus]}`}>
                        {t(`rv.${r.reviewStatus}`)}
                      </span>
                    ) : (
                      "—"
                    )}
                    {r.reviewedAt ? <div className="mt-1 whitespace-nowrap text-[12px] text-muted">{formatDateTime(r.reviewedAt, locale)}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/requests/${r.id}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                      {t("rq.view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>{t("rq.pager", { total: formatNumber(total), page: formatNumber(f.page), pages: formatNumber(pages) })}</span>
        <div className="flex gap-2">
          {f.page > 1 ? (
            <Link
              href={`/admin/requests${filtersQuery(f, { page: f.page - 1 })}`}
              className="inline-flex min-h-10 items-center rounded-[10px] border border-field bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas"
            >
              {t("common.previous")}
            </Link>
          ) : null}
          {f.page < pages ? (
            <Link
              href={`/admin/requests${filtersQuery(f, { page: f.page + 1 })}`}
              className="inline-flex min-h-10 items-center rounded-[10px] border border-field bg-white px-4 text-sm font-semibold text-ink hover:bg-canvas"
            >
              {t("common.next")}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

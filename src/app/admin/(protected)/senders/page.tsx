import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { formatDateTime, formatNumber, excelDate } from "@/lib/format";
import { EXPIRING_DAYS, addDays, senderStatus, todayRiyadh } from "@/lib/sender-status";
import { CreateSenderForm } from "./sender-forms";
import { SenderStatusChip } from "./sender-ui";
import type { T } from "@/i18n/translate";
import { customerTypeLabel, senderTypeLabel } from "@/lib/sender-types";
import { FilterChips, Pager } from "@/components/list-controls";
import { buttonClass } from "@/components/button-styles";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("senders.title") };
}

const PAGE_SIZE = 50;
const FILTERS = ["all", "active", "expiring", "expired", "missing", "disabled", "manual", "unlinked"] as const;
type Filter = (typeof FILTERS)[number];

const filterLabel = (t: T, f: Filter) =>
  ({
    all: t("common.all"),
    active: t("status.active"),
    expiring: t("sf.expiring", { days: EXPIRING_DAYS }),
    expired: t("status.expired"),
    missing: t("status.missing"),
    disabled: t("sf.disabled"),
    manual: t("status.manual"),
    unlinked: t("sf.unlinked"),
  })[f];

function filterWhere(filter: Filter, today: Date): Prisma.SenderWhereInput {
  const live = { isActive: true, missingFromFile: false, requestId: { not: null } };
  switch (filter) {
    case "active":
      return { ...live, senderExpiryDate: { gt: today } };
    case "expiring":
      return { ...live, senderExpiryDate: { gt: today, lte: addDays(today, EXPIRING_DAYS) } };
    case "expired":
      return { ...live, senderExpiryDate: { lte: today } };
    case "missing":
      return { missingFromFile: true };
    case "disabled":
      return { isActive: false };
    case "manual":
      return { requestId: null };
    case "unlinked":
      return { clientId: null };
    default:
      return {};
  }
}

function pageHref(params: { q: string; status: Filter; page?: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status !== "all") sp.set("status", params.status);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const s = sp.toString();
  return `/admin/senders${s ? `?${s}` : ""}`;
}

export default async function SendersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status: Filter = FILTERS.includes(sp.status as Filter) ? (sp.status as Filter) : "all";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const today = todayRiyadh();

  const search: Prisma.SenderWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { clientName: { contains: q, mode: "insensitive" } },
          { crNumber: { contains: q } },
          { enterpriseUnifiedNumber: { contains: q } },
          { requestId: { contains: q, mode: "insensitive" } },
          { representativeEmail: { contains: q.toLowerCase() } },
        ],
      }
    : {};
  const where: Prisma.SenderWhereInput = { AND: [search, filterWhere(status, today)] };

  const [senders, total, counts, lastImport] = await Promise.all([
    db.sender.findMany({
      where,
      orderBy: [{ nameKey: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        missingFromFile: true,
        requestId: true,
        senderExpiryDate: true,
        clientName: true,
        customerType: true,
        senderTypes: true,
        client: { select: { id: true, name: true } },
      },
    }),
    db.sender.count({ where }),
    Promise.all(FILTERS.map((f) => db.sender.count({ where: { AND: [search, filterWhere(f, today)] } }))),
    db.importBatch.findFirst({
      where: { status: { in: ["COMPLETED", "COMPLETED_WITH_ERRORS"] } },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, fileName: true },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("senders.title")}</h1>
          <p className="text-sm leading-6 text-muted">
            {lastImport ? (
              <>
                {t("senders.lastUpdate")}{" "}
                <Link href={`/admin/imports/${lastImport.id}`} className="text-brand-600 underline-offset-4 hover:underline">
                  {formatDateTime(lastImport.startedAt, locale)}
                </Link>
              </>
            ) : (
              <>{t("senders.noImport")} </>
            )}{" "}
            {t("senders.statusNote")}
          </p>
        </div>
        <Link href="/admin/imports" className={buttonClass("primary")}>
          {t("senders.updateFromExcel")}
        </Link>
      </div>

      <details className="group rounded-2xl border border-line bg-white">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 text-lg font-bold">
          {t("senders.addManual")}
          <span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="border-t border-line px-6 pb-6 pt-5">
          <CreateSenderForm />
        </div>
      </details>

      <section aria-labelledby="list-title" className="flex flex-col gap-4">
        <h2 id="list-title" className="sr-only">
          {t("senders.list")}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            label={t("senders.filterLabel")}
            items={FILTERS.map((f, i) => ({ key: f, href: pageHref({ q, status: f }), label: filterLabel(t, f), count: counts[i], active: status === f }))}
          />
          <form role="search" className="flex flex-[0_1_360px] gap-2">
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <label htmlFor="q" className="sr-only">
              {t("common.search")}
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder={t("senders.searchPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-xl border border-field bg-white px-3.5 text-sm"
            />
            <button type="submit" className="min-h-11 rounded-xl border border-field bg-white px-4 text-sm font-semibold hover:bg-canvas">
              {t("common.search")}
            </button>
          </form>
        </div>

        {senders.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center text-sm text-muted">
            {q || status !== "all" ? t("senders.noMatch") : t("senders.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.sender")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.client")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.senderType")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.expiresOn")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">{t("common.actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {senders.map((s) => (
                  <tr key={s.id} className="border-b border-hair align-top last:border-0">
                    <td className="px-4 py-3">
                      <div dir="ltr" className="font-mono font-medium">{s.name}</div>
                      {s.description ? <div className="mt-1 text-[13px] text-muted">{s.description}</div> : null}
                    </td>
                    <td className="px-4 py-3 leading-6">
                      {s.clientName ?? <span className="text-muted">—</span>}
                      {s.customerType ? <div className="text-[13px] text-muted">{customerTypeLabel(t, s.customerType)}</div> : null}
                      <div className="mt-0.5 text-[12px]">
                        {s.client ? (
                          <Link href={`/admin/clients/${s.client.id}`} className="text-brand-600 underline-offset-4 hover:underline">
                            {t("senders.linkedTo", { name: s.client.name })}
                          </Link>
                        ) : (
                          <span className="text-warn-700">{t("sf.unlinked")}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.senderTypes.length
                          ? s.senderTypes.map((x) => (
                              <span key={x} className="rounded-md bg-chip px-1.5 py-0.5 text-xs">
                                {senderTypeLabel(t, x)}
                              </span>
                            ))
                          : <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td dir="ltr" className="whitespace-nowrap px-4 py-3 font-mono text-[13px]">{excelDate(s.senderExpiryDate)}</td>
                    <td className="px-4 py-3"><SenderStatusChip status={senderStatus(s, today)} /></td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/senders/${s.id}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                        {t("common.manage")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pager
          summary={t("senders.pager", { total: formatNumber(total), page: formatNumber(page), pages: formatNumber(pages) })}
          prevHref={page > 1 ? pageHref({ q, status, page: page - 1 }) : null}
          nextHref={page < pages ? pageHref({ q, status, page: page + 1 }) : null}
        />
      </section>
    </div>
  );
}

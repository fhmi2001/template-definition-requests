import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/dal";
import { referenceText, requestPath } from "@/server/requests";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import { formatDateTime, formatNumber } from "@/lib/format";
import { REVIEW_STATUSES, REVIEW_STYLE, isReviewStatus } from "@/lib/review-status";
import { PageHeader, UserShell } from "@/components/user-shell";
import { LinkButton } from "@/components/link-button";
import { FilterChips, Pager } from "@/components/list-controls";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("my.title") };
}

const PAGE_SIZE = 20;

type Draft = { senderType: string | null; templateName: string | null; templateDescription: string | null; content: string | null };

/** المرحلة التي توقفت عندها المسودة (أول مرحلة ناقصة). */
function draftStep(d: Draft): { key: MessageKey; href: (id: string) => string } {
  if (!d.senderType) return { key: "steps.type", href: requestPath.type };
  if (!d.templateName || !d.templateDescription) return { key: "steps.template", href: requestPath.template };
  if (!d.content?.trim()) return { key: "steps.content", href: requestPath.content };
  return { key: "steps.review", href: requestPath.summary };
}

function query(p: { status?: string; q?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (p.status && p.status !== "all") sp.set("status", p.status);
  if (p.q) sp.set("q", p.q);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return `/requests${s ? `?${s}` : ""}`;
}

export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { user, client } = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const status = isReviewStatus(sp.status) ? sp.status : "all";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const own: Prisma.TemplateRequestWhereInput = { clientId: client.id, status: "SUBMITTED" };
  const refNo = /^(?:tdr-?)?0*(\d{1,9})$/i.exec(q)?.[1];
  const search: Prisma.TemplateRequestWhereInput = q
    ? {
        OR: [
          ...(refNo ? [{ referenceNo: Number(refNo) }] : []),
          { templateName: { contains: q, mode: "insensitive" } },
          { senderName: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};
  const where: Prisma.TemplateRequestWhereInput = { ...own, ...search, ...(status !== "all" ? { reviewStatus: status } : {}) };

  const [rows, total, grouped, drafts] = await Promise.all([
    db.templateRequest.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, referenceNo: true, senderName: true, templateName: true, submittedAt: true, reviewStatus: true },
    }),
    db.templateRequest.count({ where }),
    db.templateRequest.groupBy({ by: ["reviewStatus"], where: { ...own, ...search }, _count: true }),
    db.templateRequest.findMany({
      where: { clientId: client.id, status: "DRAFT", keepDraft: true, updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, senderName: true, senderType: true, templateName: true, templateDescription: true, content: true, updatedAt: true },
    }),
  ]);
  const counts = new Map(grouped.map((g) => [g.reviewStatus, g._count]));
  const all = grouped.reduce((n, g) => n + g._count, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const nothingYet = all === 0 && !q;

  return (
    <UserShell email={user.email} clientName={client.name} section="mine">
      <PageHeader title={t("my.title")} intro={t("my.intro")}>
        <LinkButton href="/home" variant="primary">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t("unav.new")}
        </LinkButton>
      </PageHeader>

      {drafts.length ? (
        <section aria-labelledby="drafts-title" className="flex flex-col gap-3">
          <h2 id="drafts-title" className="text-base font-bold">
            {t("my.drafts")}
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {drafts.map((d) => {
              const step = draftStep(d);
              return (
                <li key={d.id} className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-line-strong bg-white px-5 py-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span dir="ltr" className="truncate font-mono text-[15px] font-semibold">
                        {d.senderName}
                      </span>
                      {d.templateName ? <span className="truncate text-[14px] text-ink-2">· {d.templateName}</span> : null}
                    </span>
                    <span className="text-[13px] text-muted">
                      {t("my.draftStep", { step: t(step.key) })} · {t("my.updated", { date: formatDateTime(d.updatedAt, locale) })}
                    </span>
                  </div>
                  <LinkButton href={step.href(d.id)} variant="outline" size="sm" className="flex-none">
                    {t("my.resume")}
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {nothingYet ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-bold">{t("my.empty.title")}</h2>
          <p className="max-w-[460px] text-[15px] leading-7 text-muted">{t("my.empty.body")}</p>
          <LinkButton href="/home" variant="primary" className="mt-2">
            {t("unav.new")}
          </LinkButton>
        </section>
      ) : (
        <section aria-label={t("my.title")} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips
              label={t("my.filterLabel")}
              items={[
                { key: "all", href: query({ q }), label: t("common.all"), count: all, active: status === "all" },
                ...REVIEW_STATUSES.map((s) => ({ key: s, href: query({ status: s, q }), label: t(`rv.${s}`), count: counts.get(s) ?? 0, active: status === s })),
              ]}
            />
            <form role="search" className="relative flex-[0_1_360px]">
              {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
              <label htmlFor="q" className="sr-only">
                {t("my.search")}
              </label>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder={t("my.search")}
                className="h-11 w-full rounded-xl border border-field bg-white pe-3.5 ps-11 text-sm hover:border-field-strong"
              />
            </form>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-2xl border border-line bg-white px-4 py-10 text-center text-sm text-muted">{t("my.noResults")}</p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
              {rows.map((r) => (
                <li key={r.id} className="border-b border-hair last:border-0">
                  <Link
                    href={requestPath.submitted(r.id)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-canvas-2 md:grid-cols-[150px_minmax(0,1fr)_200px_auto]"
                  >
                    <span dir="ltr" className="font-mono text-[14px] font-semibold text-ink md:order-none">
                      {referenceText(r.referenceNo)}
                    </span>
                    {r.reviewStatus ? (
                      <span className={`justify-self-end rounded-full px-3 py-1 text-[13px] font-semibold md:order-last ${REVIEW_STYLE[r.reviewStatus]}`}>
                        {t(`rv.${r.reviewStatus}`)}
                      </span>
                    ) : (
                      <span className="md:order-last" />
                    )}
                    <span className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
                      <span className="truncate text-[15px] font-medium">{r.templateName}</span>
                      <span dir="ltr" className="flex-none rounded-md bg-chip px-1.5 py-0.5 font-mono text-[13px] text-ink-2">
                        {r.senderName}
                      </span>
                    </span>
                    <span className="col-span-2 text-[13px] text-muted md:col-span-1">{formatDateTime(r.submittedAt, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {total > PAGE_SIZE ? (
            <Pager
              summary={t("my.pager", { total: formatNumber(total), page: formatNumber(page), pages: formatNumber(pages) })}
              prevHref={page > 1 ? query({ status, q, page: page - 1 }) : null}
              nextHref={page < pages ? query({ status, q, page: page + 1 }) : null}
            />
          ) : null}
        </section>
      )}
    </UserShell>
  );
}

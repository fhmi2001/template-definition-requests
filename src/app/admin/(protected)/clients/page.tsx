import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { formatDate, formatNumber } from "@/lib/format";
import { CreateClientForm } from "./client-forms";
import { buttonClass } from "@/components/button-styles";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("clients.title") };
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);

  const where: Prisma.ClientWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { users: { some: { email: { contains: q.toLowerCase() } } } },
          { senders: { some: { nameKey: { contains: q.toLowerCase() } } } },
        ],
      }
    : {};

  const [clients, totalClients, totalEmails, activeClients] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        users: { orderBy: { createdAt: "asc" }, select: { id: true, email: true, isActive: true } },
        senders: { orderBy: { nameKey: "asc" }, take: 6, select: { id: true, name: true } },
        _count: { select: { senders: true } },
      },
    }),
    db.client.count(),
    db.user.count(),
    db.client.count({ where: { isActive: true } }),
  ]);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[640px] flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("clients.title")}</h1>
          <p className="text-sm leading-6 text-muted">
            {t("clients.intro")}
          </p>
        </div>
        <Link
          href="/admin/clients/import"
          className={buttonClass("secondary")}
        >
          {t("clients.importBtn")}
        </Link>
      </div>

      <section aria-label={t("clients.summary")} className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        {[
          { label: t("clients.total"), value: totalClients },
          { label: t("clients.active"), value: activeClients },
          { label: t("clients.emails"), value: totalEmails },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-4">
            <span className="text-[13px] text-muted">{s.label}</span>
            <span dir="ltr" className="font-mono text-[28px] font-medium">
              {formatNumber(s.value)}
            </span>
          </div>
        ))}
      </section>

      <section aria-labelledby="add-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
        <h2 id="add-title" className="text-lg font-bold">
          {t("clients.add")}
        </h2>
        <CreateClientForm />
      </section>

      <section aria-labelledby="list-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="list-title" className="text-lg font-bold">
            {t("clients.list")}
          </h2>
          <form role="search" className="flex flex-[0_1_340px] gap-2">
            <label htmlFor="q" className="sr-only">
              {t("clients.searchLabel")}
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder={t("clients.searchPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-xl border border-field bg-white px-3.5 text-sm"
            />
            <button type="submit" className="min-h-11 rounded-xl border border-field bg-white px-4 text-sm font-semibold hover:bg-canvas">
              {t("common.search")}
            </button>
          </form>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center text-sm text-muted">
            {q ? t("picker.noResults") : t("clients.empty")}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.client")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("clients.emails")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.senders")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.addedOn")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">{t("common.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-hair align-top last:border-0">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold">{c.name}</div>
                      {c.notes ? <div className="mt-1 text-[13px] text-muted">{c.notes}</div> : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <ul className="flex flex-wrap gap-1.5">
                        {c.users.map((u) => (
                          <li
                            key={u.id}
                            dir="ltr"
                            className={`rounded-md px-2 py-0.5 font-mono text-[12.5px] ${
                              u.isActive ? "bg-chip text-ink" : "bg-transparent text-subtle line-through"
                            }`}
                            title={u.isActive ? undefined : t("state.disabledM")}
                          >
                            {u.email}
                          </li>
                        ))}
                        {c.users.length === 0 ? <li className="text-[13px] text-danger-600">{t("clients.noEmail")}</li> : null}
                      </ul>
                    </td>
                    <td className="px-4 py-3.5">
                      {c._count.senders === 0 ? (
                        <span className="text-[13px] text-warn-700">{t("clients.noneShort")}</span>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5">
                          {c.senders.map((x) => (
                            <li key={x.id} dir="ltr" className="rounded-md bg-chip px-2 py-0.5 font-mono text-[12.5px]">
                              {x.name}
                            </li>
                          ))}
                          {c._count.senders > c.senders.length ? (
                            <li className="px-1 py-0.5 text-[12.5px] text-muted">+{formatNumber(c._count.senders - c.senders.length)}</li>
                          ) : null}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.isActive ? (
                        <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-[13px] font-semibold text-brand-700">{t("state.activeM")}</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-chip px-2.5 py-1 text-[13px] font-semibold text-ink-2">{t("state.disabledM")}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-muted">{formatDate(c.createdAt, locale)}</td>
                    <td className="px-4 py-3.5">
                      <Link href={`/admin/clients/${c.id}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                        {t("common.manage")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

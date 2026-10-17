import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteClientAction,
  removeEmailAction,
  toggleClientAction,
  toggleEmailAction,
  unlinkSenderAction,
} from "@/actions/clients";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { linkedSendersForAdmin } from "@/server/client-senders";
import { uuidSchema } from "@/lib/validation";
import { formatDateTime, formatNumber, excelDate } from "@/lib/format";
import { senderStatus, todayRiyadh } from "@/lib/sender-status";
import { AddEmailsForm, EditClientForm, LinkSendersForm } from "../client-forms";
import { SenderStatusChip } from "../../senders/sender-ui";
import { senderTypeLabel } from "@/lib/sender-types";
import { ConfirmButton } from "@/components/ui";
import { REVIEW_STATUSES, REVIEW_STYLE } from "@/lib/review-status";
import { referenceText } from "@/server/requests";


const REQUESTS_SHOWN = 10;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("clientDetail.title") };
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const parsed = uuidSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const client = await db.client.findUnique({
    where: { id: parsed.data },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { username: true } },
    },
  });
  if (!client) notFound();

  const submitted = { clientId: client.id, status: "SUBMITTED" as const };
  const [senders, requests, requestsTotal, byStatus] = await Promise.all([
    linkedSendersForAdmin(client.id),
    db.templateRequest.findMany({
      where: submitted,
      orderBy: [{ submittedAt: "desc" }, { referenceNo: "desc" }],
      take: REQUESTS_SHOWN,
      select: {
        id: true,
        referenceNo: true,
        templateName: true,
        senderName: true,
        submittedAt: true,
        reviewStatus: true,
        user: { select: { email: true } },
        // البريد الذي وصله تأكيد الاستلام: احتياطاً إذا حُذف بريد مقدّم الطلب
        statusChanges: { orderBy: { createdAt: "asc" }, take: 1, select: { emailTo: true } },
      },
    }),
    db.templateRequest.count({ where: submitted }),
    db.templateRequest.groupBy({ by: ["reviewStatus"], where: submitted, _count: { _all: true } }),
  ]);
  const statusCount = new Map(byStatus.map((g) => [g.reviewStatus, g._count._all]));
  const today = todayRiyadh();
  const visible = senders.filter((m) => m.isActive && !m.missingFromFile).length;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="text-[13px] text-muted">
          <Link href="/admin/clients" className="text-brand-600 underline-offset-4 hover:underline">
            {t("clients.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span> {client.name}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-bold">{client.name}</h1>
            <p className="text-sm text-muted">
              {t("clientDetail.added", { date: formatDateTime(client.createdAt, locale) })}
              {client.createdBy ? (
                <>
                  {" "}
                  {t("clientDetail.by")} <span dir="ltr">{client.createdBy.username}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {client.isActive ? (
              <span className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-600">{t("state.activeM")}</span>
            ) : (
              <span className="rounded-full bg-chip px-3 py-1.5 text-sm font-semibold text-ink-2">{t("state.disabledM")}</span>
            )}
            <form action={toggleClientAction.bind(null, client.id)}>
              {client.isActive ? (
                <ConfirmButton message={t("clientDetail.disableConfirm", { name: client.name })}>
                  {t("clientDetail.disable")}
                </ConfirmButton>
              ) : (
                <ConfirmButton variant="primary" message={t("clientDetail.enableConfirm", { name: client.name })}>
                  {t("clientDetail.enable")}
                </ConfirmButton>
              )}
            </form>
          </div>
        </div>
      </div>

      <section aria-labelledby="info-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
        <h2 id="info-title" className="text-lg font-bold">
          {t("clientDetail.info")}
        </h2>
        <EditClientForm clientId={client.id} name={client.name} notes={client.notes} />
      </section>

      <section aria-labelledby="emails-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-col gap-1">
          <h2 id="emails-title" className="text-lg font-bold">
            {t("clients.emails")}
          </h2>
          <p className="text-[13px] text-muted">{t("clientDetail.emailsIntro")}</p>
        </div>

        {client.users.length === 0 ? (
          <p className="rounded-xl bg-warn-50 px-3.5 py-3 text-sm text-warn-700">{t("clientDetail.noEmails")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.email")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{t("col.lastLogin")}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">{t("common.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {client.users.map((u) => (
                  <tr key={u.id} className="border-b border-hair last:border-0">
                    <td dir="ltr" className="px-4 py-3 font-mono text-[13px]">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[13px] font-semibold text-brand-600">{t("state.activeM")}</span>
                      ) : (
                        <span className="rounded-full bg-chip px-2.5 py-1 text-[13px] font-semibold text-ink-2">{t("state.disabledM")}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">{formatDateTime(u.lastLoginAt, locale)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <form action={toggleEmailAction.bind(null, u.id)}>
                          <ConfirmButton
                            className="min-h-10 px-3 text-[13px]"
                            message={u.isActive ? t("clientDetail.disableEmailConfirm", { email: u.email }) : t("clientDetail.enableEmailConfirm", { email: u.email })}
                          >
                            {u.isActive ? t("common.disableVerb") : t("common.enableVerb")}
                          </ConfirmButton>
                        </form>
                        <form action={removeEmailAction.bind(null, u.id)}>
                          <ConfirmButton variant="danger" className="min-h-10 px-3 text-[13px]" message={t("clientDetail.deleteEmailConfirm", { email: u.email })}>
                            {t("common.delete")}
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AddEmailsForm clientId={client.id} />
      </section>

      <section aria-labelledby="senders-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-col gap-1">
          <h2 id="senders-title" className="text-lg font-bold">
            {t("clientDetail.senders")}
          </h2>
          <p className="text-[13px] leading-6 text-muted">
            {t("clientDetail.sendersIntro")}
          </p>
        </div>

        {senders.length === 0 ? (
          <p className="rounded-xl bg-warn-50 px-3.5 py-3 text-sm text-warn-700">
            {t("clientDetail.noSenders")}
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              {t("clientDetail.linkedCount", { n: senders.length, count: formatNumber(senders.length), visible: formatNumber(visible) })}
            </p>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                    <th scope="col" className="px-4 py-3 font-semibold">Sender Name</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Client Name</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Sender Type</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("col.expiresOn")}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      <span className="sr-only">{t("common.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {senders.map((m) => (
                    <tr key={m.id} className="border-b border-hair last:border-0">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/senders/${m.id}`} dir="ltr" className="font-mono font-medium text-brand-600 underline-offset-4 hover:underline">
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{m.clientName ?? <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-2.5">{m.senderTypes.length ? m.senderTypes.map((x) => senderTypeLabel(t, x)).join(t("common.listSep")) : "—"}</td>
                      <td dir="ltr" className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px]">{excelDate(m.senderExpiryDate)}</td>
                      <td className="px-4 py-2.5"><SenderStatusChip status={senderStatus(m, today)} /></td>
                      <td className="px-4 py-2.5">
                        <form action={unlinkSenderAction.bind(null, m.id)} className="flex justify-end">
                          <ConfirmButton
                            variant="ghost"
                            className="min-h-9 whitespace-nowrap px-2.5 text-[13px] text-danger-700! hover:bg-danger-50"
                            message={t("clientDetail.unlinkConfirm", { sender: m.name, name: client.name })}
                          >
                            {t("clientDetail.unlink")}
                          </ConfirmButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <LinkSendersForm clientId={client.id} />
      </section>

      <section aria-labelledby="requests-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-col gap-1">
          <h2 id="requests-title" className="text-lg font-bold">
            {t("clientDetail.requests")}
          </h2>
          <p className="text-[13px] text-muted">{t("clientDetail.requestsIntro")}</p>
        </div>

        {requestsTotal === 0 ? (
          <p className="rounded-xl bg-canvas px-3.5 py-3 text-sm text-muted">{t("clientDetail.noRequests")}</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {REVIEW_STATUSES.map((st) => (
                <li key={st} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${REVIEW_STYLE[st]}`}>
                  {t(`rv.${st}`)} · {formatNumber(statusCount.get(st) ?? 0)}
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-start text-[13px] text-ink-2">
                    <th scope="col" className="px-4 py-3 font-semibold">{t("col.refNo")}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("col.templateName")}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Sender Name</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("col.requestedBy")}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("col.submittedAt")}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("col.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const by = r.user?.email ?? r.statusChanges[0]?.emailTo ?? null;
                    return (
                      <tr key={r.id} className="border-b border-hair last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <Link href={`/admin/requests/${r.id}`} dir="ltr" className="font-mono font-medium text-brand-600 underline-offset-4 hover:underline">
                            {referenceText(r.referenceNo)}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">{r.templateName ?? "—"}</td>
                        <td dir="ltr" className="px-4 py-2.5 font-mono text-[13px]">{r.senderName}</td>
                        <td dir="ltr" className="px-4 py-2.5 font-mono text-[13px]">
                          {by ?? <span dir="auto" className="font-sans text-muted">{t("clientDetail.removedEmail")}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-[13px] text-muted">{formatDateTime(r.submittedAt, locale)}</td>
                        <td className="px-4 py-2.5">
                          {r.reviewStatus ? (
                            <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${REVIEW_STYLE[r.reviewStatus]}`}>{t(`rv.${r.reviewStatus}`)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {requestsTotal > REQUESTS_SHOWN ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-muted">{t("clientDetail.requestsLatest", { n: formatNumber(REQUESTS_SHOWN), total: formatNumber(requestsTotal) })}</span>
                <Link href={`/admin/requests?client=${client.id}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                  {t("clientDetail.viewAllRequests")}
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="danger-title" className="flex flex-col gap-3 rounded-2xl border border-danger-200 bg-white p-6">
        <h2 id="danger-title" className="text-lg font-bold text-danger-700">
          {t("clientDetail.delete")}
        </h2>
        <p className="text-sm leading-6 text-muted">{t("clientDetail.deleteIntro")}</p>
        <form action={deleteClientAction.bind(null, client.id)}>
          <ConfirmButton variant="danger" pendingText={t("common.deleting")} message={t("clientDetail.deleteConfirm", { name: client.name })}>
            {t("clientDetail.deleteForever")}
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}

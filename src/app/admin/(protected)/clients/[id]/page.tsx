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
import { formatDateTime, formatNumber } from "@/lib/format";
import { senderStatus, todayRiyadh } from "@/lib/sender-status";
import { AddEmailsForm, ConfirmButton, EditClientForm, LinkSendersForm } from "../client-forms";
import { SenderStatusChip, excelDate, senderTypeLabel } from "../../senders/sender-ui";


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

  const senders = await linkedSendersForAdmin(client.id);
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
              <span className="rounded-full bg-[#e9ece8] px-3 py-1.5 text-sm font-semibold text-[#3f4945]">{t("state.disabledM")}</span>
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
          <p className="rounded-[10px] bg-warn-50 px-3.5 py-3 text-sm text-warn-700">{t("clientDetail.noEmails")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-start text-[13px] text-[#3f4945]">
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
                  <tr key={u.id} className="border-b border-[#eceeeb] last:border-0">
                    <td dir="ltr" className="px-4 py-3 font-mono text-[13px]">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[13px] font-semibold text-brand-600">{t("state.activeM")}</span>
                      ) : (
                        <span className="rounded-full bg-[#e9ece8] px-2.5 py-1 text-[13px] font-semibold text-[#3f4945]">{t("state.disabledM")}</span>
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
          <p className="rounded-[10px] bg-warn-50 px-3.5 py-3 text-sm text-warn-700">
            {t("clientDetail.noSenders")}
          </p>
        ) : (
          <>
            <p className="text-sm text-[#3f4945]">
              {t("clientDetail.linkedCount", { n: senders.length, count: formatNumber(senders.length), visible: formatNumber(visible) })}
            </p>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-start text-[13px] text-[#3f4945]">
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
                    <tr key={m.id} className="border-b border-[#eceeeb] last:border-0">
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

      <section aria-labelledby="danger-title" className="flex flex-col gap-3 rounded-2xl border border-[#efc9c5] bg-white p-6">
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

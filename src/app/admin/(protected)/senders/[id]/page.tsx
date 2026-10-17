import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteSenderAction, toggleSenderAction } from "@/actions/senders";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { uuidSchema } from "@/lib/validation";
import { formatDateTime } from "@/lib/format";
import { senderStatus } from "@/lib/sender-status";
import { Alert } from "@/components/ui";
import { ConfirmButton } from "../../clients/client-forms";
import { EditSenderForm } from "../sender-forms";
import { SenderStatusChip, customerTypeLabel, excelDate, senderTypeLabel } from "../sender-ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("senderDetail.title") };
}

function Row({ label, children, ltr }: { label: string; children: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#eceeeb] py-3 sm:flex-row sm:gap-4">
      <dt className="text-[13px] text-muted sm:w-48 sm:flex-none">{label}</dt>
      <dd dir={ltr ? "ltr" : undefined} className={`min-w-0 break-words text-sm ${ltr ? "font-mono" : ""}`}>
        {children ?? <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}

export default async function SenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const parsed = uuidSchema.safeParse((await params).id);
  if (!parsed.success) notFound();

  const s = await db.sender.findUnique({
    where: { id: parsed.data },
    include: {
      lastImport: { select: { id: true, startedAt: true } },
      createdBy: { select: { username: true } },
      client: { select: { id: true, name: true } },
    },
  });
  if (!s) notFound();

  const status = senderStatus(s);
  const linked = s.requestId !== null;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="text-[13px] text-muted">
          <Link href="/admin/senders" className="text-brand-600 underline-offset-4 hover:underline">
            {t("senders.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span> <span dir="ltr">{s.name}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 dir="ltr" className="font-mono text-3xl font-medium">
              {s.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <SenderStatusChip status={status} />
              <span className="rounded-md bg-[#e9ece8] px-2 py-0.5 text-xs font-semibold text-[#3f4945]">
                {linked ? t("senderDetail.fromExcel") : t("senderDetail.manual")}
              </span>
            </div>
            <p className="text-sm text-muted">
              {s.client ? (
                <>
                  {t("senderDetail.linkedTo")}{" "}
                  <Link href={`/admin/clients/${s.client.id}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                    {s.client.name}
                  </Link>
                </>
              ) : (
                t("senderDetail.notLinked")
              )}
            </p>
          </div>
          <form action={toggleSenderAction.bind(null, s.id)}>
            {s.isActive ? (
              <ConfirmButton message={t("senderDetail.disableConfirm", { name: s.name })}>{t("senderDetail.disable")}</ConfirmButton>
            ) : (
              <ConfirmButton variant="primary" message={t("senderDetail.enableConfirm", { name: s.name })}>
                {t("senderDetail.enable")}
              </ConfirmButton>
            )}
          </form>
        </div>
      </div>

      {s.missingFromFile ? (
        <Alert tone="warning">
          {t("senderDetail.missingNote")}
        </Alert>
      ) : null}

      <section aria-labelledby="excel-title" className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="excel-title" className="text-lg font-bold">
            {t("senderDetail.lastPaid")}
          </h2>
          {s.lastImport ? (
            <span className="text-[13px] text-muted">
              {t("senderDetail.lastSeen")}{" "}
              <Link href={`/admin/imports/${s.lastImport.id}`} className="text-brand-600 underline-offset-4 hover:underline">
                {formatDateTime(s.lastImport.startedAt, locale)}
              </Link>
            </span>
          ) : null}
        </div>
        {linked ? (
          <dl className="flex flex-col">
            <Row label="Request Id" ltr>{s.requestId}</Row>
            <Row label={t("senderDetail.requestStatus")} ltr>{s.requestStatus}</Row>
            <Row label={t("senderDetail.requestDate")} ltr>{excelDate(s.requestDate)}</Row>
            <Row label={t("senderDetail.requestExpiry")} ltr>{excelDate(s.expiryDate)}</Row>
            <Row label={t("senderDetail.senderExpiry")} ltr>{excelDate(s.senderExpiryDate)}</Row>
            <Row label={t("col.senderType")}>{s.senderTypes.length ? s.senderTypes.map((x) => senderTypeLabel(t, x)).join(t("common.listSep")) : null}</Row>
            <Row label={t("col.client")}>{s.clientName}</Row>
            <Row label={t("senderDetail.customerType")}>{customerTypeLabel(t, s.customerType)}</Row>
            <Row label={t("senderDetail.unified")} ltr>{s.enterpriseUnifiedNumber}</Row>
            <Row label={t("senderDetail.cr")} ltr>{s.crNumber}</Row>
            <Row label={t("senderDetail.repName")}>{s.representativeName}</Row>
            <Row label={t("senderDetail.repEmail")} ltr>{s.representativeEmail}</Row>
            <Row label={t("senderDetail.repMobile")} ltr>{s.representativeMobile}</Row>
          </dl>
        ) : (
          <p className="text-sm leading-6 text-muted">
            {t("senderDetail.manualNote")}
            {s.createdBy ? <> {t("clientDetail.by")} <span dir="ltr">{s.createdBy.username}</span></> : null}
            {t("senderDetail.manualNoteTail")}
          </p>
        )}
      </section>

      <section aria-labelledby="edit-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
        <h2 id="edit-title" className="text-lg font-bold">
          {t("senderDetail.nameDesc")}
        </h2>
        <EditSenderForm senderId={s.id} name={s.name} description={s.description} linkedToExcel={linked} />
      </section>

      <section aria-labelledby="danger-title" className="flex flex-col gap-3 rounded-2xl border border-[#efc9c5] bg-white p-6">
        <h2 id="danger-title" className="text-lg font-bold text-danger-700">
          {t("senderDetail.delete")}
        </h2>
        {linked ? (
          <p className="text-sm leading-6 text-muted">
            {t("senderDetail.cantDelete")}
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted">{t("senderDetail.deleteIntro")}</p>
            <form action={deleteSenderAction.bind(null, s.id)}>
              <ConfirmButton variant="danger" pendingText={t("common.deleting")} message={t("senderDetail.deleteConfirm", { name: s.name })}>
                {t("senderDetail.deleteForever")}
              </ConfirmButton>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

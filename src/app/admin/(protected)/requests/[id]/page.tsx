import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/dal";
import { getPledge, referenceText } from "@/server/requests";
import { requestRecipient } from "@/server/request-review";
import { getT } from "@/i18n/server";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import { REVIEW_STYLE } from "@/lib/review-status";
import { messageSignature, sanitizeSpecs } from "@/lib/template-rules";
import { uuidSchema } from "@/lib/validation";
import { RequestDetails } from "@/app/(user)/request/request-details";
import { AutoRefresh } from "../../imports/[id]/auto-refresh";
import { ResendEmailButton, StatusForm } from "./review-forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await getT();
  const id = uuidSchema.safeParse((await params).id);
  const r = id.success ? await db.templateRequest.findUnique({ where: { id: id.data }, select: { referenceNo: true } }) : null;
  return { title: r ? t("rq.detailTitle", { ref: referenceText(r.referenceNo) }) : t("rq.d.title") };
}

const card = "flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6";

export default async function RequestReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { t, locale } = await getT();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const r = await db.templateRequest.findFirst({
    where: { id: id.data, status: "SUBMITTED" },
    include: {
      client: { select: { id: true, name: true } },
      user: { select: { email: true, isActive: true } },
      sender: { select: { id: true, clientName: true, enterpriseUnifiedNumber: true, crNumber: true } },
      statusChanges: { orderBy: { createdAt: "desc" }, include: { admin: { select: { username: true } } } },
    },
  });
  if (!r) notFound();

  const [pledge, recipient] = await Promise.all([getPledge(r.id), requestRecipient(r)]);
  const ref = referenceText(r.referenceNo);
  const reqLocale = isLocale(r.locale) ? r.locale : DEFAULT_LOCALE;
  // بريد ما زال يُرسل: نحدّث الصفحة تلقائياً لنعرض النتيجة
  const sending = r.statusChanges.some((c) => c.emailStatus === null && Date.now() - c.createdAt.getTime() < 2 * 60 * 1000);

  return (
    <div className="flex flex-col gap-6">
      {sending ? <AutoRefresh everyMs={2500} /> : null}
      <div className="flex flex-col gap-3">
        <div className="text-[13px] text-muted">
          <Link href="/admin/requests" className="text-brand-600 underline-offset-4 hover:underline">
            {t("rq.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span> <span dir="ltr">{ref}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-bold">
            <span dir="ltr" className="font-mono">
              {ref}
            </span>
          </h1>
          {r.reviewStatus ? (
            <span data-testid="review-status" className={`rounded-full px-3 py-1 text-sm font-semibold ${REVIEW_STYLE[r.reviewStatus]}`}>
              {t(`rv.${r.reviewStatus}`)}
            </span>
          ) : null}
          {r.authorityRef ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-chip px-3 py-1 text-sm text-ink-2">
              {t("authorityRef.label")}
              <span dir="ltr" className="font-mono font-semibold text-ink">
                {r.authorityRef}
              </span>
            </span>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted">
          <Link href={`/admin/clients/${r.client.id}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
            {r.client.name}
          </Link>{" "}
          ·{" "}
          {r.user
            ? t("rq.d.submittedBy", { email: r.user.email, date: formatDateTime(r.submittedAt, locale) })
            : t("rq.d.submittedOn", { date: formatDateTime(r.submittedAt, locale) })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          {r.reviewStatus === "REJECTED" && r.rejectionReason ? (
            <div className="rounded-2xl bg-danger-50 px-5 py-4 text-danger-700">
              <div className="text-[13px] font-semibold">{t("rq.d.lastReason")}</div>
              <p dir="auto" className="mt-1 whitespace-pre-wrap text-[15px] leading-7 [text-align:match-parent]">
                {r.rejectionReason}
              </p>
            </div>
          ) : null}
          <RequestDetails
            copyable
            r={{
              senderName: r.senderName,
              senderClientName: r.sender?.clientName ?? null,
              senderType: r.senderType,
              awarenessClientName: r.awarenessClientName,
              templateName: r.templateName,
              templateDescription: r.templateDescription,
              content: r.content,
              signature: messageSignature(r.senderType, r.awarenessClientName),
              specs: sanitizeSpecs(r.variables),
              customerType: r.customerType,
              exceptions: r.exceptions,
              pledge: pledge ? { fileName: pledge.fileName, href: `/admin/requests/${r.id}/attachments/${pledge.id}` } : null,
              // أرقام المنشأة من بيانات المرسل المستوردة من ملف الإكسل (للإدارة فقط)
              enterprise: { unified: r.sender?.enterpriseUnifiedNumber ?? null, cr: r.sender?.crNumber ?? null },
            }}
          />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <section aria-labelledby="status-title" className={card}>
            <h2 id="status-title" className="text-lg font-bold">
              {t("rq.d.statusTitle")}
            </h2>
            <StatusForm requestId={r.id} current={r.reviewStatus} authorityRef={r.authorityRef} />
            <p className="text-[13px] leading-5 text-muted">
              {recipient ? t("rq.d.emailTo", { email: `\u2068${recipient}\u2069`, lang: t(`lang.${reqLocale}`) }) : t("rq.d.noEmail")}
            </p>
          </section>

          <section aria-labelledby="history-title" className={card}>
            <h2 id="history-title" className="text-lg font-bold">
              {t("rq.h.title")}
            </h2>
            <ol className="flex flex-col">
              {r.statusChanges.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 border-t border-hair py-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${REVIEW_STYLE[c.toStatus]}`}>{t(`rv.${c.toStatus}`)}</span>
                    <span className="text-[13px] text-muted">{formatDateTime(c.createdAt, locale)}</span>
                  </div>
                  <div className="text-[13px] leading-6 text-ink-2">
                    {c.fromStatus ? t("rq.h.changed", { from: t(`rv.${c.fromStatus}`), to: t(`rv.${c.toStatus}`) }) : t("rq.h.received")}
                    {c.admin ? (
                      <>
                        {" "}
                        · {t("rq.h.by")} <span dir="ltr">{c.admin.username}</span>
                      </>
                    ) : null}
                  </div>
                  {c.reason ? (
                    <div className="rounded-lg bg-canvas px-3 py-2 text-[13px] leading-6">
                      <span className="font-semibold">{t("rq.h.reason")}</span>{" "}
                      <span dir="auto" className="whitespace-pre-wrap">
                        {c.reason}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className={`text-[13px] ${
                      c.emailStatus === "SENT" ? "text-brand-700" : c.emailStatus === "FAILED" ? "text-danger-700" : "text-muted"
                    }`}
                  >
                    {c.emailStatus === null
                      ? t("rq.mail.pending")
                      : c.emailStatus === "SKIPPED"
                        ? t("rq.mail.SKIPPED")
                        : t(`rq.mail.${c.emailStatus}`, { email: c.emailTo ?? "—" })}
                    {c.emailStatus === "FAILED" && c.emailError ? (
                      <span dir="ltr" className="mt-0.5 block font-mono text-[13px] text-muted">
                        {c.emailError}
                      </span>
                    ) : null}
                  </div>
                  {c.emailStatus === "FAILED" || c.emailStatus === "SKIPPED" ? <ResendEmailButton changeId={c.id} /> : null}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

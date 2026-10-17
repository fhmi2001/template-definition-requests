import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { draftSpecs, getOwnRequest, getPledge, referenceText, requestPath } from "@/server/requests";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/format";
import { messageSignature } from "@/lib/template-rules";
import { REVIEW_STYLE } from "@/lib/review-status";
import { UserShell } from "@/components/user-shell";
import { LinkButton } from "@/components/link-button";
import { RequestDetails } from "../../request-details";
import { StatusTracker } from "../../status-tracker";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("submitted.title") };
}

export default async function RequestSubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requireUser();
  const request = await getOwnRequest(client.id, (await params).id);
  if (!request) notFound();
  if (request.status === "DRAFT") redirect(requestPath.summary(request.id));
  const { t, locale } = await getT();

  const [pledge, sender, changes] = await Promise.all([
    getPledge(request.id),
    request.senderId ? db.sender.findUnique({ where: { id: request.senderId }, select: { clientName: true } }) : null,
    db.requestStatusChange.findMany({ where: { requestId: request.id }, orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true } }),
  ]);
  const ref = referenceText(request.referenceNo);

  return (
    <UserShell email={user.email} clientName={client.name} section="mine">
      <section className="relative overflow-hidden rounded-2xl border border-brand-200 bg-white">
        <div aria-hidden="true" className="h-1.5 bg-brand-400" />
        <div className="flex flex-wrap items-center justify-between gap-6 px-6 py-7 sm:px-8">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="flex size-12 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-[28px] font-bold leading-tight sm:text-[32px]">{t("submitted.heading")}</h1>
              <p className="text-[14px] text-muted">
                {t("submitted.ref")}{" "}
                <span dir="ltr" className="font-mono text-[15px] font-semibold text-ink">
                  {ref}
                </span>
                {request.submittedAt ? <> · {formatDateTime(request.submittedAt, locale)}</> : null}
              </p>
            </div>
          </div>
          {request.reviewStatus ? (
            <p className="flex items-center gap-2 text-[14px]">
              <span className="text-muted">{t("submitted.status")}</span>
              <span data-testid="review-status" className={`rounded-full px-3 py-1 text-[13px] font-semibold ${REVIEW_STYLE[request.reviewStatus]}`}>
                {t(`rv.${request.reviewStatus}`)}
              </span>
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {request.reviewStatus === "REJECTED" && request.rejectionReason ? (
            <div role="note" className="rounded-2xl border border-danger-200 bg-danger-50 px-5 py-4 text-danger-700">
              <div className="text-[13px] font-semibold">{t("mail.reason")}</div>
              <p dir="auto" className="mt-1 whitespace-pre-wrap text-[15px] leading-7 [text-align:match-parent]">
                {request.rejectionReason}
              </p>
            </div>
          ) : null}
          <RequestDetails
            r={{
              senderName: request.senderName,
              senderClientName: sender?.clientName ?? null,
              senderType: request.senderType,
              awarenessClientName: request.awarenessClientName,
              templateName: request.templateName,
              templateDescription: request.templateDescription,
              content: request.content,
              signature: messageSignature(request.senderType, request.awarenessClientName),
              specs: draftSpecs(request.variables),
              customerType: request.customerType,
              exceptions: request.exceptions,
              pledge: pledge ? { fileName: pledge.fileName, href: requestPath.attachment(request.id, pledge.id) } : null,
            }}
          />
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {request.reviewStatus ? <StatusTracker status={request.reviewStatus} changes={changes} locale={locale} /> : null}
          <p className="px-1 text-[13px] leading-6 text-muted">{t("submitted.keep")}</p>
          <div className="flex flex-wrap gap-3 px-1">
            <LinkButton href="/requests" size="sm">
              {t("submitted.back")}
            </LinkButton>
            <LinkButton href="/home" variant="primary" size="sm">
              {t("unav.new")}
            </LinkButton>
          </div>
        </aside>
      </div>
    </UserShell>
  );
}

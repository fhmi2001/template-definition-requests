import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { draftSpecs, getOwnRequest, getPledge, referenceText, requestPath } from "@/server/requests";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/format";
import { messageSignature } from "@/lib/template-rules";
import { UserShell } from "@/components/user-shell";
import { RequestDetails } from "../../request-details";
import { REVIEW_STYLE } from "@/lib/review-status";

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

  const [pledge, sender] = await Promise.all([
    getPledge(request.id),
    request.senderId ? db.sender.findUnique({ where: { id: request.senderId }, select: { clientName: true } }) : null,
  ]);

  return (
    <UserShell email={user.email} clientName={client.name}>
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-[#c9dfd6] bg-white px-6 py-10 text-center">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
        <h1 className="text-[26px] font-bold">{t("submitted.heading")}</h1>
        <p className="text-[15px] leading-7 text-muted">
          {t("submitted.ref")}{" "}
          <span dir="ltr" className="font-mono text-lg font-semibold text-ink">
            {referenceText(request.referenceNo)}
          </span>
          {request.submittedAt ? <> · {formatDateTime(request.submittedAt, locale)}</> : null}
        </p>
        {request.reviewStatus ? (
          <p className="flex items-center gap-2 text-[15px]">
            <span className="text-muted">{t("submitted.status")}</span>
            <span data-testid="review-status" className={`rounded-full px-3 py-1 text-[13px] font-semibold ${REVIEW_STYLE[request.reviewStatus]}`}>
              {t(`rv.${request.reviewStatus}`)}
            </span>
          </p>
        ) : null}
        {request.reviewStatus === "REJECTED" && request.rejectionReason ? (
          <div className="w-full max-w-[560px] rounded-xl bg-danger-50 px-4 py-3 text-start text-[14px] leading-7 text-danger-700">
            <div className="font-semibold">{t("mail.reason")}</div>
            <div dir="auto" className="whitespace-pre-wrap [text-align:match-parent]">{request.rejectionReason}</div>
          </div>
        ) : null}
        <p className="max-w-[520px] text-[14px] leading-7 text-muted">{t("submitted.keep")}</p>
        <Link
          href="/home"
          className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-brand-600 px-5 text-[15px] font-semibold text-white hover:bg-brand-700"
        >
          {t("home.title")}
        </Link>
      </section>

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
    </UserShell>
  );
}

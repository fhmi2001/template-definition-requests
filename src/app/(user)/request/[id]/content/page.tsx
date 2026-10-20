import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { draftSpecs, isFromReview, loadDraftForPage, requestPath, stepsDone } from "@/server/requests";
import { AWARENESS, senderTypeDisplay, customerTypeDisplay } from "@/lib/sender-types";
import { isGovernment, messageSignature } from "@/lib/template-rules";
import { UserShell } from "@/components/user-shell";
import { ChosenSender, SenderGone, StepHeader } from "../../request-ui";
import { ContentEditor } from "./content-editor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("content.title") };
}

export default async function RequestContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { user, client } = await requireUser();
  const { draft, sender, pledge } = await loadDraftForPage(client.id, (await params).id);
  const review = isFromReview((await searchParams).from);
  // لا يمكن تخطي المراحل السابقة
  if (!draft.senderType) redirect(requestPath.type(draft.id));
  if (!draft.templateName || !draft.templateDescription) redirect(requestPath.template(draft.id));

  const { t } = await getT();
  const extra = [
    { label: t("col.senderType"), value: senderTypeDisplay(t, draft.senderType) },
    ...(draft.senderType === AWARENESS && draft.awarenessClientName ? [{ label: "Client Name", value: draft.awarenessClientName }] : []),
    { label: t("template.name"), value: draft.templateName },
  ];
  const ct = sender?.customerType ?? null;
  const customerTypeText = ct ? customerTypeDisplay(t, ct) : t("content.ctUnknown");

  return (
    <UserShell email={user.email} clientName={client.name}>
      <StepHeader current={4} draftId={draft.id} done={stepsDone(draft)} title={t("content.title")} intro={t("content.intro")} />

      {!sender ? (
        <SenderGone changeHref={requestPath.sender(draft.id)} />
      ) : (
        <>
          <ChosenSender name={sender.name} clientName={sender.clientName} extra={extra} changeHref={requestPath.sender(draft.id)} />
          <ContentEditor
            draftId={draft.id}
            initialText={draft.content ?? ""}
            initialSpecs={draftSpecs(draft.variables)}
            customerType={ct}
            customerTypeText={customerTypeText}
            government={isGovernment(ct)}
            pledge={pledge ? { fileName: pledge.fileName, size: pledge.size, href: requestPath.attachment(draft.id, pledge.id) } : null}
            pledgeTemplateHref={requestPath.pledgeTemplate(draft.id)}
            backHref={review ? requestPath.summary(draft.id) : requestPath.template(draft.id)}
            fromReview={review}
            signature={messageSignature(draft.senderType, draft.awarenessClientName)}
            signatureEditHref={requestPath.type(draft.id)}
            senderName={sender.name}
            initiallyKept={draft.keepDraft}
          />
        </>
      )}
    </UserShell>
  );
}

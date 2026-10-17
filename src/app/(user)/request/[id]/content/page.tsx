import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { draftSpecs, getPledge, loadDraftForPage, requestPath } from "@/server/requests";
import { AWARENESS, senderTypeDisplay } from "@/lib/sender-types";
import { isGovernment, messageSignature } from "@/lib/template-rules";
import { RequestSteps, UserShell } from "@/components/user-shell";
import { customerTypeDisplay } from "@/app/admin/(protected)/senders/sender-ui";
import { ChosenSender, SenderGone } from "../../request-ui";
import { ContentEditor } from "./content-editor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("content.title") };
}

export default async function RequestContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requireUser();
  const { draft, sender } = await loadDraftForPage(client.id, (await params).id);
  // لا يمكن تخطي المراحل السابقة
  if (!draft.senderType) redirect(requestPath.type(draft.id));
  if (!draft.templateName || !draft.templateDescription) redirect(requestPath.template(draft.id));

  const pledge = await getPledge(draft.id);
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
      <div className="flex flex-col gap-4">
        <RequestSteps current={4} draftId={draft.id} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("content.title")}</h1>
          <p className="text-[15px] leading-7 text-muted">
            {t("content.intro")}
          </p>
        </div>
      </div>

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
            backHref={requestPath.template(draft.id)}
            signature={messageSignature(draft.senderType, draft.awarenessClientName)}
            signatureEditHref={requestPath.type(draft.id)}
          />
        </>
      )}
    </UserShell>
  );
}

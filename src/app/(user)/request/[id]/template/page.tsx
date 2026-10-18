import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { isFromReview, loadDraftForPage, requestPath, stepsDone } from "@/server/requests";
import { AWARENESS, senderTypeDisplay } from "@/lib/sender-types";
import { UserShell } from "@/components/user-shell";
import { ChosenSender, SenderGone, StepHeader } from "../../request-ui";
import { TemplateForm } from "./template-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("template.title") };
}

export default async function RequestTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { user, client } = await requireUser();
  const { draft, sender } = await loadDraftForPage(client.id, (await params).id);
  const review = isFromReview((await searchParams).from);
  // لا يمكن تخطي مرحلة نوع المرسل
  if (!draft.senderType) redirect(requestPath.type(draft.id));
  const { t } = await getT();

  const extra = [{ label: t("col.senderType"), value: senderTypeDisplay(t, draft.senderType) }];
  if (draft.senderType === AWARENESS && draft.awarenessClientName) extra.push({ label: "Client Name", value: draft.awarenessClientName });

  return (
    <UserShell email={user.email} clientName={client.name}>
      <StepHeader current={3} draftId={draft.id} done={stepsDone(draft)} title={t("home.title")} intro={t("template.intro")} />

      {!sender ? (
        <SenderGone changeHref={requestPath.sender(draft.id)} />
      ) : (
        <>
          <ChosenSender name={sender.name} clientName={sender.clientName} extra={extra} changeHref={requestPath.sender(draft.id)} />
          <TemplateForm
            draftId={draft.id}
            initialName={draft.templateName ?? ""}
            initialDescription={draft.templateDescription ?? ""}
            backHref={review ? requestPath.summary(draft.id) : requestPath.type(draft.id)}
            fromReview={review}
          />
        </>
      )}
    </UserShell>
  );
}

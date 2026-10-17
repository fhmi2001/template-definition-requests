import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { loadDraftForPage, requestPath } from "@/server/requests";
import { AWARENESS, senderTypeDisplay } from "@/lib/sender-types";
import { RequestSteps, UserShell } from "@/components/user-shell";
import { ChosenSender, SenderGone } from "../../request-ui";
import { TemplateForm } from "./template-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("template.title") };
}

export default async function RequestTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requireUser();
  const { draft, sender } = await loadDraftForPage(client.id, (await params).id);
  // لا يمكن تخطي مرحلة نوع المرسل
  if (!draft.senderType) redirect(requestPath.type(draft.id));
  const { t } = await getT();

  const extra = [{ label: t("col.senderType"), value: senderTypeDisplay(t, draft.senderType) }];
  if (draft.senderType === AWARENESS && draft.awarenessClientName) extra.push({ label: "Client Name", value: draft.awarenessClientName });

  return (
    <UserShell email={user.email} clientName={client.name}>
      <div className="flex flex-col gap-4">
        <RequestSteps current={3} draftId={draft.id} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("home.title")}</h1>
          <p className="text-[15px] leading-7 text-muted">{t("template.intro")}</p>
        </div>
      </div>

      {!sender ? (
        <SenderGone changeHref={requestPath.sender(draft.id)} />
      ) : (
        <>
          <ChosenSender name={sender.name} clientName={sender.clientName} extra={extra} changeHref={requestPath.sender(draft.id)} />
          <TemplateForm
            draftId={draft.id}
            initialName={draft.templateName ?? ""}
            initialDescription={draft.templateDescription ?? ""}
            backHref={requestPath.type(draft.id)}
          />
        </>
      )}
    </UserShell>
  );
}

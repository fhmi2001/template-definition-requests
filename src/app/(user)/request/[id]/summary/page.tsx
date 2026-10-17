import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { checkDraftComplete, draftSpecs, getPledge, loadDraftForPage, requestPath } from "@/server/requests";
import { messageSignature, normalizeTemplate } from "@/lib/template-rules";
import { Alert } from "@/components/ui";
import { RequestSteps, UserShell } from "@/components/user-shell";
import { SenderGone } from "../../request-ui";
import { RequestDetails } from "../../request-details";
import { SubmitPanel } from "./submit-panel";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("summary.title") };
}

export default async function RequestSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requireUser();
  const { draft, sender } = await loadDraftForPage(client.id, (await params).id);
  if (!draft.senderType) redirect(requestPath.type(draft.id));
  if (!draft.templateName || !draft.templateDescription) redirect(requestPath.template(draft.id));
  if (!draft.content?.trim()) redirect(requestPath.content(draft.id));

  const [check, pledge] = await Promise.all([checkDraftComplete(draft, sender), getPledge(draft.id)]);
  const { t } = await getT();
  const normalized = normalizeTemplate(draft.content, draftSpecs(draft.variables));

  return (
    <UserShell email={user.email} clientName={client.name}>
      <div className="flex flex-col gap-4">
        <RequestSteps current={5} draftId={draft.id} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("summary.title")}</h1>
          <p className="text-[15px] leading-7 text-muted">{t("summary.intro")}</p>
        </div>
      </div>

      {!sender ? (
        <SenderGone changeHref={requestPath.sender(draft.id)} />
      ) : (
        <>
          {!check.ok ? (
            <Alert>
              {t(check.message)}{" "}
              <Link href={requestPath[check.step](draft.id)} className="font-semibold underline">
                {t("summary.goToStep")}
              </Link>
            </Alert>
          ) : (
            <Alert tone="success">{t("summary.ready")}</Alert>
          )}
          <RequestDetails
            r={{
              senderName: sender.name,
              senderClientName: sender.clientName,
              senderType: draft.senderType,
              awarenessClientName: draft.awarenessClientName,
              templateName: draft.templateName,
              templateDescription: draft.templateDescription,
              content: normalized.text,
              signature: messageSignature(draft.senderType, draft.awarenessClientName),
              specs: normalized.specs,
              customerType: sender.customerType,
              exceptions: check.ok ? check.evaluation.exceptions : draft.exceptions,
              pledge: pledge ? { fileName: pledge.fileName, href: requestPath.attachment(draft.id, pledge.id) } : null,
            }}
            edit={{
              sender: requestPath.sender(draft.id),
              type: requestPath.type(draft.id),
              template: requestPath.template(draft.id),
              content: requestPath.content(draft.id),
            }}
          />
          <SubmitPanel draftId={draft.id} canSubmit={check.ok} backHref={requestPath.content(draft.id)} />
        </>
      )}
    </UserShell>
  );
}

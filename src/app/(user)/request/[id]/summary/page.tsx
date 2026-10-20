import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { checkDraftComplete, draftSpecs, fromReview, loadDraftForPage, requestPath, stepsDone } from "@/server/requests";
import { messageSignature, normalizeTemplate } from "@/lib/template-rules";
import { Alert } from "@/components/ui";
import { UserShell } from "@/components/user-shell";
import { SenderGone, StepHeader } from "../../request-ui";
import { RequestDetails } from "../../request-details";
import { SubmitPanel } from "./submit-panel";
import { DuplicateNotice } from "../../duplicate-notice";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("summary.title") };
}

export default async function RequestSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requireUser();
  const { draft, sender, pledge } = await loadDraftForPage(client.id, (await params).id);
  // مسودة لم تصل للمراجعة بعد تكمل من حيث توقفت؛ أما ما نقص بعد تعديل من هنا (مثل نوع مُسح بتغيير المرسل) فيُعرض مع رابط لإكماله
  const done = stepsDone(draft);
  if (!done[2] && !done[3]) redirect(requestPath.type(draft.id));

  const check = await checkDraftComplete(draft, sender, pledge);
  const { t } = await getT();
  const normalized = normalizeTemplate(draft.content ?? "", draftSpecs(draft.variables));

  return (
    <UserShell email={user.email} clientName={client.name}>
      <StepHeader current={5} draftId={draft.id} done={done} title={t("summary.title")} intro={t("summary.intro")} />

      {!sender ? (
        <SenderGone changeHref={requestPath.sender(draft.id)} />
      ) : (
        <>
          {!check.ok && check.duplicate ? (
            <DuplicateNotice
              dup={check.duplicate}
              edit={{
                sender: fromReview(requestPath.sender(draft.id)),
                type: fromReview(requestPath.type(draft.id)),
                content: fromReview(requestPath.content(draft.id)),
              }}
            />
          ) : !check.ok ? (
            <Alert>
              {t(check.message)}{" "}
              <Link href={fromReview(requestPath[check.step](draft.id))} className="font-semibold underline">
                {t("summary.fixStep")}
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
              sender: fromReview(requestPath.sender(draft.id)),
              type: fromReview(requestPath.type(draft.id)),
              template: fromReview(requestPath.template(draft.id)),
              content: fromReview(requestPath.content(draft.id)),
            }}
          />
          <SubmitPanel
            draftId={draft.id}
            canSubmit={check.ok}
            backHref={requestPath.content(draft.id)}
            blocked={check.ok ? null : { message: t(check.message), href: fromReview(requestPath[check.step](draft.id)) }}
          />
        </>
      )}
    </UserShell>
  );
}

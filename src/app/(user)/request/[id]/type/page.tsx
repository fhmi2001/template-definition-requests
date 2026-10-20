import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/dal";
import { isFromReview, loadDraftForPage, requestPath, stepsDone } from "@/server/requests";
import { allowedSenderTypes, senderTypeLabel } from "@/lib/sender-types";
import { UserShell } from "@/components/user-shell";
import { ChosenSender, SenderGone, StepHeader } from "../../request-ui";
import { TypeForm } from "./type-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("type.title") };
}

export default async function RequestTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { user, client } = await requireUser();
  const { draft, sender } = await loadDraftForPage(client.id, (await params).id);
  const review = isFromReview((await searchParams).from);
  const { t } = await getT();

  // الأنواع الأربعة لكل العملاء: الاسم بلغة المستخدم، والقيمة الأصلية إن اختلفت، ثم تعريف النوع وأمثلته
  const options = sender
    ? allowedSenderTypes().map((value) => {
        const label = senderTypeLabel(t, value);
        return {
          value,
          label,
          sub: label === value ? null : value,
          purpose: t.x(`senderType.purpose.${value}`),
          examples: t.x(`senderType.examples.${value}`),
        };
      })
    : [];
  // نوع واحد فقط متاح: يُختار مسبقاً
  const initialType = draft.senderType ?? (options.length === 1 ? options[0].value : undefined);

  return (
    <UserShell email={user.email} clientName={client.name}>
      <StepHeader current={2} draftId={draft.id} done={stepsDone(draft)} title={t("home.title")} intro={t("type.intro")} />

      {!sender ? (
        <SenderGone changeHref={requestPath.sender(draft.id)} />
      ) : (
        <>
          <ChosenSender name={sender.name} clientName={sender.clientName} changeHref={requestPath.sender(draft.id)} />
          <TypeForm
            draftId={draft.id}
            options={options}
            initialType={initialType}
            defaultClientName={draft.awarenessClientName ?? sender.clientName ?? client.name}
            backHref={review ? requestPath.summary(draft.id) : requestPath.sender(draft.id)}
            fromReview={review}
          />
        </>
      )}
    </UserShell>
  );
}

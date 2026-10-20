import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/dal";
import { isFromReview, loadDraftForPage, requestPath, stepsDone } from "@/server/requests";
import { AD_SENDER_NAME_MAX, SENDER_TYPES, isTypeBlocked, senderNameLength, senderTypeLabel } from "@/lib/sender-types";
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

  // الأنواع الأربعة لكل العملاء: الاسم بلغة المستخدم، والقيمة الأصلية إن اختلفت، ثم تعريف النوع وأمثلته.
  // الإعلاني يظهر معطّلاً مع السبب إن كان اسم المرسل أطول من 8 أحرف.
  const options = sender
    ? SENDER_TYPES.map((value) => {
        const label = senderTypeLabel(t, value);
        const blocked = isTypeBlocked(value, sender.name);
        return {
          blocked: blocked
            ? t("type.adBlocked", { max: AD_SENDER_NAME_MAX, name: sender.name, n: senderNameLength(sender.name) })
            : null,
          value,
          label,
          sub: label === value ? null : value,
          purpose: t.x(`senderType.purpose.${value}`),
          examples: t.x(`senderType.examples.${value}`).split("|"),
          rule: t.x(`senderType.rule.${value}`),
        };
      })
    : [];
  // نوع محفوظ لم يعد متاحاً (مثلاً إعلاني بعد تغيير المرسل) لا يُعرض مختاراً
  const available = options.filter((o) => !o.blocked);
  const saved = available.some((o) => o.value === draft.senderType) ? (draft.senderType ?? undefined) : undefined;
  const initialType = saved ?? (available.length === 1 ? available[0].value : undefined);

  return (
    <UserShell email={user.email} clientName={client.name}>
      <StepHeader current={2} draftId={draft.id} done={stepsDone(draft)} title={t("type.heading")} intro={t("type.intro")} />

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

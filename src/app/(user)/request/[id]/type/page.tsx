import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/dal";
import { loadDraftForPage, requestPath } from "@/server/requests";
import { allowedSenderTypes } from "@/lib/sender-types";
import { senderTypeLabel } from "@/app/admin/(protected)/senders/sender-ui";
import { RequestSteps, UserShell } from "@/components/user-shell";
import { ChosenSender, SenderGone } from "../../request-ui";
import { TypeForm } from "./type-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("type.title") };
}

export default async function RequestTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, client } = await requireUser();
  const { draft, sender } = await loadDraftForPage(client.id, (await params).id);
  const { t } = await getT();

  // الاسم بلغة المستخدم، والقيمة الأصلية تحته إن اختلفت (مثل «توعوي» ثم Awareness)
  const options = sender
    ? allowedSenderTypes(sender.senderTypes).map((value) => {
        const label = senderTypeLabel(t, value);
        return { value, label, sub: label === value ? null : value };
      })
    : [];
  // نوع واحد فقط متاح: يُختار مسبقاً
  const initialType = draft.senderType ?? (options.length === 1 ? options[0].value : undefined);

  return (
    <UserShell email={user.email} clientName={client.name}>
      <div className="flex flex-col gap-4">
        <RequestSteps current={2} draftId={draft.id} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("home.title")}</h1>
          <p className="text-[15px] leading-7 text-muted">{t("type.intro")}</p>
        </div>
      </div>

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
            backHref={requestPath.sender(draft.id)}
          />
        </>
      )}
    </UserShell>
  );
}

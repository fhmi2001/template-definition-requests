import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/dal";
import { availableSendersForClient } from "@/server/client-senders";
import { LinkButton } from "@/components/link-button";
import { db } from "@/server/db";
import { getDraft, requestPath } from "@/server/requests";
import { formatDateTime } from "@/lib/format";
import { todayRiyadh } from "@/lib/sender-status";
import { UserShell } from "@/components/user-shell";
import { StepHeader } from "@/app/(user)/request/request-ui";
import { SenderPicker, type PickableSender } from "./sender-picker";
import { senderTypeLabel } from "@/lib/sender-types";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("home.title") };
}

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { user, client } = await requireUser();
  const { t, locale } = await getT();
  const sp = await searchParams;
  const [rows, draft] = await Promise.all([availableSendersForClient(client.id), sp.draft ? getDraft(client.id, sp.draft) : null]);
  // طلب لم يكتمل (وصل لبيانات القالب على الأقل) خلال آخر 30 يوماً: نعرض رابط متابعته فقط
  const unfinished = draft
    ? null
    : await db.templateRequest.findFirst({
        where: {
          clientId: client.id,
          status: "DRAFT",
          templateName: { not: null },
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, senderName: true, templateName: true, content: true, updatedAt: true },
      });
  const today = todayRiyadh();

  const senders: PickableSender[] = rows.map((s) => ({
    id: s.id,
    name: s.name,
    clientName: s.clientName,
    types: s.senderTypes.map((x) => senderTypeLabel(t, x)),
    expired: s.senderExpiryDate !== null && s.senderExpiryDate <= today,
  }));
  // العودة من مرحلة لاحقة تُبقي الاختيار وتحدّث نفس المسودة، بشرط أن يكون المرسل من قائمة هذا العميل
  const initialSelected = draft && senders.some((s) => s.id === draft.senderId) ? (draft.senderId ?? undefined) : undefined;

  return (
    <UserShell email={user.email} clientName={client.name}>
      <StepHeader current={1} draftId={draft?.id} title={t("home.title")} intro={t("home.intro")} />

      {unfinished ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-25 px-5 py-4">
          <p className="text-[15px] leading-7">
            {t("home.unfinished")} <span dir="ltr" className="font-mono font-semibold">{unfinished.senderName}</span> · {unfinished.templateName}
            <span className="text-[13px] text-muted"> · {t("home.lastEdit", { date: formatDateTime(unfinished.updatedAt, locale) })}</span>
          </p>
          <LinkButton href={requestPath.content(unfinished.id)} variant="outline" size="sm">
            {t("home.resume")}
          </LinkButton>
        </div>
      ) : null}

      {senders.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-bold">{t("home.noSenders")}</h2>
          <p className="max-w-[520px] text-[15px] leading-7 text-muted">{t("home.noSendersHint")}</p>
        </section>
      ) : (
        <SenderPicker senders={senders} initialSelected={initialSelected} draftId={draft?.id} />
      )}
    </UserShell>
  );
}

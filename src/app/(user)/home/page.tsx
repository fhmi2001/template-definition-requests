import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/dal";
import { availableSendersForClient } from "@/server/client-senders";
import Link from "next/link";
import { db } from "@/server/db";
import { getDraft, requestPath } from "@/server/requests";
import { formatDateTime } from "@/lib/format";
import { todayRiyadh } from "@/lib/sender-status";
import { RequestSteps, UserShell } from "@/components/user-shell";
import { senderTypeLabel } from "@/app/admin/(protected)/senders/sender-ui";
import { SenderPicker, type PickableSender } from "./sender-picker";

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
      <div className="flex flex-col gap-4">
        <RequestSteps current={1} draftId={draft?.id} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[28px] font-bold">{t("home.title")}</h1>
          <p className="text-[15px] leading-7 text-muted">{t("home.intro")}</p>
        </div>
      </div>

      {unfinished ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c9dfd6] bg-white px-5 py-4">
          <p className="text-[15px] leading-7">
            {t("home.unfinished")} <span dir="ltr" className="font-mono font-semibold">{unfinished.senderName}</span> · {unfinished.templateName}
            <span className="text-[13px] text-muted"> · {t("home.lastEdit", { date: formatDateTime(unfinished.updatedAt, locale) })}</span>
          </p>
          <Link
            href={requestPath.content(unfinished.id)}
            className="inline-flex min-h-10 items-center rounded-[10px] border border-brand-600 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            {t("home.resume")}
          </Link>
        </div>
      ) : null}

      {senders.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-bold">{t("home.noSenders")}</h2>
          <p className="max-w-[520px] text-[15px] leading-7 text-muted">{t("home.noSendersHint")}</p>
        </section>
      ) : (
        <SenderPicker senders={senders} initialSelected={initialSelected} draftId={draft?.id} />
      )}
    </UserShell>
  );
}

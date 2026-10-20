import Link from "next/link";
import { getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/format";
import { REVIEW_STYLE } from "@/lib/review-status";
import { senderTypeDisplay } from "@/lib/sender-types";
import { referenceText, requestPath, type DuplicateRequest } from "@/server/requests";
import { LinkButton } from "@/components/link-button";
import { MessageBubble } from "@/components/message-bubble";

/**
 * يمنع تقديم طلب مكرر: طلب سابق غير مرفوض بنفس اسم المرسل ونوعه ونص الرسالة.
 * يعرض بيانات الطلب السابق، وروابط لتغيير أحد الثلاثة (تعود إلى المراجعة بعد الحفظ).
 */
export async function DuplicateNotice({
  dup,
  edit,
}: {
  dup: DuplicateRequest;
  edit: { sender: string; type: string; content: string };
}) {
  const { t, locale } = await getT();
  const ref = referenceText(dup.referenceNo);

  return (
    <section
      role="alert"
      aria-labelledby="dup-title"
      className="flex flex-col gap-5 rounded-2xl border border-danger-200 bg-danger-50 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 id="dup-title" className="text-lg font-bold text-danger-700">
          {t("dup.title")}
        </h2>
        <p className="text-[15px] leading-7 text-ink-2">{t("dup.body")}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[13px] text-muted">{t("dup.previous")}</span>
          <Link
            href={requestPath.submitted(dup.id)}
            dir="ltr"
            className="font-mono text-[15px] font-semibold text-brand-700 underline-offset-4 hover:underline"
          >
            {ref}
          </Link>
          {dup.reviewStatus ? (
            <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${REVIEW_STYLE[dup.reviewStatus]}`}>
              {t(`rv.${dup.reviewStatus}`)}
            </span>
          ) : null}
        </div>

        <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
          {dup.authorityRef ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-[13px] text-muted">{t("authorityRef.label")}</dt>
              <dd dir="ltr" className="font-mono font-semibold [text-align:match-parent]">
                {dup.authorityRef}
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-muted">{t("mail.f.submittedAt")}</dt>
            <dd>{formatDateTime(dup.submittedAt, locale)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-muted">{t("template.name")}</dt>
            <dd dir="auto" className="[text-align:match-parent]">
              {dup.templateName ?? "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[13px] text-muted">{t("col.senderType")}</dt>
            <dd>{dup.senderType ? senderTypeDisplay(t, dup.senderType) : "—"}</dd>
          </div>
        </dl>

        <div className="rounded-xl bg-canvas px-4 py-4">
          <MessageBubble sender={dup.senderName}>
            <span className="whitespace-pre-wrap">{dup.message}</span>
          </MessageBubble>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[14px] font-semibold text-ink-2">{t("dup.changeOne")}</p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href={edit.content} variant="primary">
            {t("details.editContent")}
          </LinkButton>
          <LinkButton href={edit.type}>{t("details.editType")}</LinkButton>
          <LinkButton href={edit.sender}>{t("details.editSender")}</LinkButton>
        </div>
      </div>
    </section>
  );
}

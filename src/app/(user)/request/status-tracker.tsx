import type { ReviewStatus } from "@/generated/prisma/enums";
import type { Locale } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { formatDateTime } from "@/lib/format";

type Change = { toStatus: ReviewStatus; createdAt: Date };

/**
 * مراحل الطلب بعد التقديم: الاستلام ← المراجعة ← القرار (اعتماد أو رفض).
 * تاريخ كل مرحلة من آخر تغيير للحالة إليها.
 */
export async function StatusTracker({
  status,
  changes,
  locale,
  authorityRef,
}: {
  status: ReviewStatus;
  changes: Change[];
  locale: Locale;
  /** رقم القالب (لدى هيئة الاتصالات): يظهر أعلى المتابعة كما في رسائل البريد، أياً كان مسار الطلب */
  authorityRef: string | null;
}) {
  const { t } = await getT();
  const at = (s: ReviewStatus) => changes.filter((c) => c.toStatus === s).at(-1)?.createdAt ?? null;
  const decided = status === "APPROVED" || status === "REJECTED";
  const reached = status === "RECEIVED" ? 0 : status === "UNDER_REVIEW" ? 1 : 2;

  const stages = [
    { key: "RECEIVED", label: t("track.RECEIVED"), date: at("RECEIVED") },
    { key: "UNDER_REVIEW", label: t("track.UNDER_REVIEW"), date: at("UNDER_REVIEW") },
    { key: "DECISION", label: decided ? t(`track.${status}`) : t("track.decision"), date: decided ? at(status) : null },
  ];

  return (
    <section aria-labelledby="track-title" className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="track-title" className="text-base font-bold">
          {t("track.title")}
        </h2>
        {authorityRef ? (
          <span className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-chip px-3 py-1.5 text-[13px] text-ink-2">
            {t("authorityRef.label")}
            <span dir="ltr" className="font-mono text-[15px] font-semibold text-ink">
              {authorityRef}
            </span>
          </span>
        ) : null}
      </div>
      <ol className="flex flex-col">
        {stages.map((s, i) => {
          const done = i <= reached;
          const current = i === reached;
          const rejected = current && status === "REJECTED";
          return (
            <li key={s.key} aria-current={current ? "step" : undefined} className="relative flex gap-3.5 pb-6 last:pb-0">
              {i < stages.length - 1 ? (
                <span aria-hidden="true" className={`absolute start-[13px] top-8 bottom-1 w-0.5 rounded-full ${i < reached ? "bg-brand-400" : "bg-line"}`} />
              ) : null}
              <span
                aria-hidden="true"
                className={`relative flex size-7 flex-none items-center justify-center rounded-full ${
                  rejected ? "bg-danger-600 text-white" : done ? "bg-brand-600 text-white" : "border-2 border-line-strong bg-white"
                } ${current && !decided ? "ring-4 ring-brand-100" : ""}`}
              >
                {rejected ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
                    <path d="M7 7l10 10M17 7L7 17" />
                  </svg>
                ) : done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                ) : null}
              </span>
              <div className="flex flex-col gap-0.5 pt-0.5">
                <span className={`text-[15px] ${done ? "font-semibold text-ink" : "text-muted"}`}>{s.label}</span>
                <span className="text-[13px] text-muted">{done && s.date ? formatDateTime(s.date, locale) : done ? "" : t("track.notYet")}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

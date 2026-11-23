"use client";

import { createContext, useActionState, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { bulkChangeStatusAction } from "@/actions/request-review";
import { initialState } from "@/lib/action-state";
import { REJECTION_REASON_MAX, REVIEW_STATUSES, isReviewStatus, needsAuthorityRef } from "@/lib/review-status";
import { Alert, ConfirmButton, inputClass } from "@/components/ui";
import { buttonClass } from "@/components/button-styles";
import { useT } from "@/i18n/client";

/** أقصى عدد إشعارات في عملية واحدة (يطابق الخادم). */
const NOTIFY_MAX = 25;
/** أقصى عدد طلبات في عملية واحدة (يطابق الخادم). */
const BULK_MAX = 100;

type Ctx = {
  selected: Set<string>;
  allResults: boolean;
  pageIds: string[];
  total: number;
  filters: string;
  toggle: (id: string) => void;
  togglePage: () => void;
  selectAllResults: () => void;
  clear: () => void;
};
const SelectionContext = createContext<Ctx | null>(null);
const useSelection = () => {
  const c = useContext(SelectionContext);
  if (!c) throw new Error("BulkProvider missing");
  return c;
};

/** حالة الاختيار المشتركة بين مربعات الصفوف وشريط التغيير الجماعي. تُصفَّر عند تغيير الصفحة أو الفلاتر. */
export function BulkProvider({ pageIds, total, filters, children }: { pageIds: string[]; total: number; filters: string; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [allResults, setAllResults] = useState(false);

  const value = useMemo<Ctx>(
    () => ({
      selected,
      allResults,
      pageIds,
      total,
      filters,
      toggle: (id) => {
        setAllResults(false);
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      },
      togglePage: () => {
        setAllResults(false);
        setSelected((prev) => (pageIds.every((id) => prev.has(id)) ? new Set() : new Set(pageIds)));
      },
      selectAllResults: () => {
        setSelected(new Set(pageIds));
        setAllResults(true);
      },
      clear: () => {
        setSelected(new Set());
        setAllResults(false);
      },
    }),
    [selected, allResults, pageIds, total, filters],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

const box = "size-4 cursor-pointer accent-brand-600";

export function RowCheck({ id, refText }: { id: string; refText: string }) {
  const { selected, toggle } = useSelection();
  const t = useT();
  return (
    <label className="-m-3 flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
      <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} className={box} aria-label={t("rq.bulk.select", { ref: refText })} />
    </label>
  );
}

export function HeadCheck() {
  const { selected, pageIds, togglePage } = useSelection();
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const count = pageIds.filter((id) => selected.has(id)).length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && count < pageIds.length;
  }, [count, pageIds.length]);
  return (
    <label className="-m-3 flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
      <input ref={ref} type="checkbox" checked={count === pageIds.length && count > 0} onChange={togglePage} className={box} aria-label={t("rq.bulk.selectPage")} />
    </label>
  );
}

/** شريط التغيير الجماعي: يظهر عند وجود اختيار، ويثبت أسفل الشاشة. */
export function BulkBar() {
  const { selected, allResults, pageIds, total, filters, selectAllResults, clear } = useSelection();
  const t = useT();
  const [state, action] = useActionState(bulkChangeStatusAction, initialState);
  const [status, setStatus] = useState("");
  const [silent, setSilent] = useState(false);
  const [reasonLength, setReasonLength] = useState(0);

  useEffect(() => {
    if (state.ok) {
      clear();
      setStatus("");
      setSilent(false);
      setReasonLength(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const count = allResults ? total : selected.size;
  const rejecting = status === "REJECTED";
  const canOfferAll = !allResults && total > pageIds.length && selected.size === pageIds.length;
  const tooMany = count > BULK_MAX;
  const tooManyToNotify = !tooMany && !silent && count > NOTIFY_MAX;

  // الرسالة بعد النجاح تبقى ظاهرة حتى بعد تصفير الاختيار
  if (count === 0) {
    return state.ok && state.message ? (
      <div role="status" className="sticky bottom-4 z-10">
        <Alert tone="success">{state.message}</Alert>
      </div>
    ) : null;
  }

  return (
    <form
      action={action}
      noValidate
      aria-label={t("rq.bulk.title")}
      className="sticky bottom-4 z-10 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 shadow-[0_16px_40px_-20px_rgb(0_0_0/0.45)]"
    >
      <input type="hidden" name="scope" value={allResults ? "all" : "ids"} />
      {allResults ? <input type="hidden" name="filters" value={filters} /> : [...selected].map((id) => <input key={id} type="hidden" name="ids" value={id} />)}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold" role="status">
          {allResults ? t("rq.bulk.allSelected", { n: total }) : t("rq.bulk.selected", { n: selected.size })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canOfferAll ? (
            <button type="button" onClick={selectAllResults} className={buttonClass("secondary", "sm")}>
              {t("rq.bulk.selectAllResults", { n: total })}
            </button>
          ) : null}
          <button type="button" onClick={clear} className={buttonClass("ghost", "sm")}>
            {t("rq.bulk.clear")}
          </button>
        </div>
      </div>

      {state.error ? <Alert tone={state.tone ?? "error"}>{state.error}</Alert> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bulk-status" className="text-[13px] font-semibold text-ink-2">
            {t("rq.d.newStatus")}
          </label>
          <select
            id="bulk-status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-invalid={!!state.fields?.status}
            className={inputClass(!!state.fields?.status)}
          >
            <option value="">{t("rq.bulk.chooseStatus")}</option>
            {REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`rv.${s}`)}
              </option>
            ))}
          </select>
          {state.fields?.status ? (
            <p role="alert" className="text-[13px] text-danger-600">
              {state.fields.status}
            </p>
          ) : null}
        </div>

        {rejecting ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-reason" className="text-[13px] font-semibold text-ink-2">
              {t("rq.d.reason")} <span className="text-danger-600">*</span>
            </label>
            <textarea
              id="bulk-reason"
              name="reason"
              rows={3}
              maxLength={REJECTION_REASON_MAX}
              dir="auto"
              defaultValue={state.values?.reason ?? ""}
              onChange={(e) => setReasonLength(Array.from(e.target.value).length)}
              aria-invalid={!!state.fields?.reason}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] leading-7 ${state.fields?.reason ? "border-danger-600" : "border-field"}`}
            />
            {state.fields?.reason ? (
              <p role="alert" className="text-[13px] text-danger-600">
                {state.fields.reason}
              </p>
            ) : null}
            <div className="flex items-start justify-between gap-3 text-[13px] text-muted">
              <span>{t("rq.bulk.reasonHint")}</span>
              <span dir="ltr" className="flex-none font-mono">
                {reasonLength} / {REJECTION_REASON_MAX}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {needsAuthorityRef(status) ? <p className="text-[13px] leading-6 text-muted">{t("rq.bulk.refNote")}</p> : null}

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink-2">
        <input type="checkbox" name="silent" checked={silent} onChange={(e) => setSilent(e.target.checked)} className="size-4 accent-brand-600" />
        {t("rq.silent.label")}
      </label>
      {tooMany ? <Alert tone="warning">{t("rq.bulk.err.tooMany", { max: BULK_MAX })}</Alert> : null}
      {tooManyToNotify ? <Alert tone="warning">{t("rq.bulk.err.notifyCap", { max: NOTIFY_MAX, count })}</Alert> : null}

      <div>
        <ConfirmButton
          variant={rejecting ? "danger" : "primary"}
          pendingText={t("rq.d.saving")}
          disabled={!status || tooMany || tooManyToNotify}
          message={isReviewStatus(status) ? t(silent ? "rq.bulk.confirmSilent" : "rq.bulk.confirm", { n: count, status: t(`rv.${status}`) }) : ""}
        >
          {t("rq.bulk.apply", { n: count })}
        </ConfirmButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import { chooseSenderAction } from "@/actions/requests";
import { initialState } from "@/lib/action-state";
import { Alert, SubmitButton } from "@/components/ui";
import { useT } from "@/i18n/client";

export type PickableSender = {
  id: string;
  name: string;
  clientName: string | null;
  types: string[];
  expired: boolean;
};

const SEARCH_FROM = 10;

/**
 * بطاقات أسماء المرسلين مع اختيار واحد فقط.
 * كل بطاقة label لـ input من نوع radio (اختيار واحد أصلاً، ويعمل بلوحة المفاتيح).
 */
export function SenderPicker({
  senders,
  initialSelected,
  draftId,
}: {
  senders: PickableSender[];
  initialSelected?: string;
  draftId?: string;
}) {
  const [state, action] = useActionState(chooseSenderAction, initialState);
  const [selected, setSelected] = useState<string | undefined>(initialSelected);
  const [q, setQ] = useState("");
  const t = useT();

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return senders;
    return senders.filter((s) => s.name.toLowerCase().includes(term) || (s.clientName ?? "").toLowerCase().includes(term));
  }, [q, senders]);
  const chosen = senders.find((s) => s.id === selected);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {draftId ? <input type="hidden" name="draftId" value={draftId} /> : null}
      {/* القيمة المرسلة من الحالة: React يعيد ضبط أزرار الاختيار بعد كل رد خطأ، والحقل المخفي لا يتأثر */}
      <input type="hidden" name="senderId" value={selected ?? ""} />
      {state.error ? <Alert>{state.error}</Alert> : null}

      {senders.length >= SEARCH_FROM ? (
        <div className="relative max-w-[420px]">
          <label htmlFor="sender-search" className="sr-only">
            {t("picker.searchLabel")}
          </label>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            id="sender-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("picker.searchPlaceholder")}
            className="h-12 w-full rounded-xl border border-field bg-white pe-3.5 ps-11 text-[15px] hover:border-field-strong"
          />
        </div>
      ) : null}

      <fieldset className="min-w-0">
        <legend className="sr-only">{t("picker.legend")}</legend>
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-white px-4 py-10 text-center text-sm text-muted">{t("picker.noResults")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((s) => {
              const isOn = s.id === selected;
              return (
                <label
                  key={s.id}
                  htmlFor={`sender-${s.id}`}
                  className={`relative flex min-h-[104px] cursor-pointer flex-col gap-3 rounded-2xl border bg-white p-4 transition-[border-color,box-shadow,background-color] has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-300 ${
                    isOn ? "border-brand-600 bg-brand-25 shadow-[inset_0_0_0_1px_var(--color-brand-600)]" : "border-line hover:border-field-strong"
                  }`}
                >
                  <input
                    id={`sender-${s.id}`}
                    type="radio"
                    name="senderChoice"
                    value={s.id}
                    checked={isOn}
                    onChange={() => setSelected(s.id)}
                    aria-labelledby={`sender-${s.id}-name`}
                    aria-describedby={`sender-${s.id}-details`}
                    className="sr-only"
                  />
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`flex size-9 flex-none items-center justify-center rounded-full text-sm font-bold ${isOn ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}
                      >
                        {s.name.trim().charAt(0).toUpperCase()}
                      </span>
                      <span id={`sender-${s.id}-name`} dir="ltr" className="truncate font-mono text-[15px] font-semibold">
                        {s.name}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 flex size-5 flex-none items-center justify-center rounded-full border-2 ${isOn ? "border-brand-600 bg-brand-600 text-white" : "border-field-strong bg-white"}`}
                    >
                      {isOn ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      ) : null}
                    </span>
                  </span>
                  {/* اسم العميل والأنواع وحالة الانتهاء: تُقرأ مع اسم المرسل */}
                  <span id={`sender-${s.id}-details`} className="flex flex-col gap-2">
                    <span className="text-[14px] leading-6 text-ink-2">{s.clientName ?? <span className="text-muted">—</span>}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {s.types.map((ty) => (
                        <span key={ty} className="rounded-md bg-chip px-2 py-0.5 text-[13px] text-ink-2">
                          {ty}
                        </span>
                      ))}
                      {s.expired ? <span className="rounded-md bg-warn-50 px-2 py-0.5 text-[13px] font-semibold text-warn-700">{t("picker.expired")}</span> : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:bottom-4 sm:mx-0 sm:rounded-2xl sm:border sm:px-5 sm:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.25)]">
        <p aria-live="polite" className="text-sm text-muted">
          {chosen ? (
            <>
              {t("picker.chosen")}{" "}
              <span dir="ltr" className="font-mono font-semibold text-ink">
                {chosen.name}
              </span>
            </>
          ) : (
            t("picker.noneChosen")
          )}
        </p>
        <SubmitButton pendingText={t("adminLogin.checking")} className="min-w-32">
          {t("common.next")}
        </SubmitButton>
      </div>
    </form>
  );
}

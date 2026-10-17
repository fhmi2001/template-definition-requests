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
 * جدول أسماء المرسلين مع اختيار واحد فقط.
 * نستخدم input من نوع radio (اختيار واحد أصلاً، ويعمل بلوحة المفاتيح) بشكل مربع اختيار.
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
        <div className="flex max-w-[360px] flex-col gap-1.5">
          <label htmlFor="sender-search" className="sr-only">
            {t("picker.searchLabel")}
          </label>
          <input
            id="sender-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("picker.searchPlaceholder")}
            className="h-11 w-full rounded-[10px] border border-field bg-white px-3.5 text-sm"
          />
        </div>
      ) : null}

      <fieldset className="min-w-0">
        <legend className="sr-only">{t("picker.legend")}</legend>
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-start text-[13px] text-[#3f4945]">
                <th scope="col" className="w-10 py-3 ps-3 pe-1 font-semibold sm:w-14 sm:px-4">
                  <span className="sr-only">{t("picker.select")}</span>
                </th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">{t("col.senderName")}</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">{t("col.clientName")}</th>
                <th scope="col" className="py-3 pe-3 ps-2 font-semibold sm:px-4">{t("col.senderType")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const isOn = s.id === selected;
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className={`cursor-pointer border-b border-[#eceeeb] last:border-0 ${isOn ? "bg-brand-50" : "hover:bg-canvas"}`}
                  >
                    <td className="py-3 ps-3 pe-1 sm:px-4">
                      <input
                        id={`sender-${s.id}`}
                        type="radio"
                        name="senderChoice"
                        value={s.id}
                        checked={isOn}
                        onChange={() => setSelected(s.id)}
                        aria-label={t("picker.selectName", { name: s.name })}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`flex size-5 items-center justify-center rounded-[5px] border-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 ${
                          isOn ? "border-brand-600 bg-brand-600 text-white" : "border-[#8a9590] bg-white"
                        }`}
                      >
                        {isOn ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-3 sm:px-4">
                      <label htmlFor={`sender-${s.id}`} className="flex cursor-pointer flex-wrap items-center gap-2">
                        <span dir="ltr" className="font-mono font-medium">
                          {s.name}
                        </span>
                        {s.expired ? (
                          <span className="rounded-full bg-[#e9ece8] px-2 py-0.5 text-xs font-semibold text-[#3f4945]">{t("picker.expired")}</span>
                        ) : null}
                      </label>
                    </td>
                    <td className="px-2 py-3 leading-6 sm:px-4">{s.clientName ?? <span className="text-muted">—</span>}</td>
                    <td className="py-3 pe-3 ps-2 sm:px-4">
                      {s.types.length ? (
                        <div className="flex flex-wrap gap-1">
                          {s.types.map((ty) => (
                            <span key={ty} className="rounded-md bg-[#e9ece8] px-1.5 py-0.5 text-xs">
                              {ty}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                    {t("picker.noResults")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </fieldset>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-white">
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

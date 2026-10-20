"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  removePledgeAction,
  saveContentAction,
  keepDraftAction,
  saveContentDraftAction,
  uploadPledgeAction,
} from "@/actions/requests";
import { initialState } from "@/lib/action-state";
import {
  MAX_VARIABLES,
  MAX_VARIABLE_LENGTH,
  TEMPLATE_MAX_LENGTH,
  VARIABLE_LENGTH_CEILING,
  VARIABLE_TYPES,
  charCount,
  exceptionLabel,
  cleanTemplateText,
  composeMessage,
  estimateSms,
  evaluateTemplate,
  findTokens,
  markTokens,
  markedIndex,
  normalizeTemplate,
  splitTokens,
  tokenText,
  type RuleResult,
  type RuleStatus,
  type VariableSpec,
  type VariableType,
} from "@/lib/template-rules";
import { Alert } from "@/components/ui";
import { TemplatePreview } from "../../template-preview";
import { buttonClass } from "@/components/button-styles";
import { StepFooter } from "@/components/step-footer";
import { MessageBubble } from "@/components/message-bubble";
import { useLocale, useT } from "@/i18n/client";
import { msg, type MessageKey } from "@/i18n/core";
import { formatTime } from "@/lib/format";
import { useAutosave, type AutosaveStatus } from "./use-autosave";

type Pledge = { fileName: string; size: number; href: string } | null;

const card = "flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6";
/** مهلة التوقف عن الكتابة قبل إظهار الشروط غير المحققة */
const SETTLE_MS = 900;
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const STATUS: Record<RuleStatus, { label: MessageKey; ring: string; icon: React.ReactNode }> = {
  pass: { label: "rs.pass", ring: "bg-brand-600 text-white", icon: <path d="M5 12l5 5L20 7" /> },
  fail: { label: "rs.fail", ring: "bg-danger-600 text-white", icon: <path d="M7 7l10 10M17 7L7 17" /> },
  pending: { label: "rs.pending", ring: "border-2 border-dashed border-field-strong text-transparent", icon: null },
  note: { label: "rs.note", ring: "bg-warn-600 text-white", icon: <path d="M12 7v6M12 17h.01" /> },
  exception: { label: "rs.exception", ring: "bg-info-700 text-white", icon: <path d="M12 7v6M12 17h.01" /> },
};

/** نص فيه متغيرات: كل متغير معزول باتجاه LTR حتى يظهر #Var1# صحيحاً داخل الجملة العربية. */
function WithTokens({ text }: { text: string }) {
  return (
    <>
      {splitTokens(text).map((p, i) =>
        p.token ? (
          <bdi key={i} dir="ltr">
            {p.text}
          </bdi>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

function RuleItem({ r }: { r: RuleResult }) {
  const t = useT();
  const s = STATUS[r.status];
  return (
    <li className="flex gap-3 py-3">
      <span aria-hidden="true" className={`mt-0.5 flex size-6 flex-none items-center justify-center rounded-full ${s.ring}`}>
        {s.icon ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            {s.icon}
          </svg>
        ) : null}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="text-sm font-semibold leading-6">
          {r.number ? <span className="text-muted">{r.number}. </span> : null}
          {msg(t, r.title)}
          <span className="sr-only"> — {t(s.label)}</span>
        </div>
        {r.status !== "pass" || r.details.length ? (
          <ul className="flex flex-col gap-0.5 text-[13px] leading-6 text-ink-2">
            {r.status !== "pass" ? (
              <li
                className={`text-[13px] font-semibold ${
                  r.status === "fail" ? "text-danger-700" : r.status === "note" ? "text-warn-700" : r.status === "exception" ? "text-info-700" : "text-muted"
                }`}
              >
                {t(s.label)}
              </li>
            ) : null}
            {r.details.map((d, i) => (
              <li key={i} className="break-words">
                <WithTokens text={msg(t, d)} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/** حالة الحفظ التلقائي بجانب عدّاد الأحرف. الخطأ وحده يُعلَن لقارئ الشاشة حتى لا يتكرر الإعلان مع كل توقف. */
/** kept: حُفظ بـ«حفظ والعودة لاحقاً». غير المحفوظ يُحذف عند الخروج، فلا نقول «حُفظ» بإطلاق. */
function SaveStatus({ status, onRetry, kept }: { status: AutosaveStatus; onRetry: () => void; kept: boolean }) {
  const t = useT();
  const locale = useLocale();
  if (status.kind === "idle") return <span />;
  if (status.kind === "error") {
    return (
      <span role="alert" className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-danger-700">
        {status.message ?? t("autosave.failed")}
        <button type="button" onClick={onRetry} className="min-h-11 sm:min-h-9 rounded-lg px-1.5 underline underline-offset-4 hover:bg-danger-50">
          {t("autosave.retry")}
        </button>
      </span>
    );
  }
  return (
    <span className="flex min-h-9 items-center gap-1.5 text-[13px] text-muted">
      {status.kind === "saved" ? (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600">
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : (
        <span aria-hidden="true" className={`size-1.5 rounded-full ${status.kind === "saving" ? "bg-brand-400" : "bg-field-strong"}`} />
      )}
      {status.kind === "saved"
        ? t(kept ? "autosave.saved" : "autosave.savedSession", { time: formatTime(status.at, locale) })
        : status.kind === "saving"
          ? t("common.saving")
          : t("autosave.unsaved")}
    </span>
  );
}

/** مقتطف قصير حول المتغير ليعرف العميل أي متغير هذا. */
function contextOf(text: string, start: number, end: number) {
  const before = text.slice(Math.max(0, start - 18), start).replace(/\s+/g, " ");
  const after = text.slice(end, end + 18).replace(/\s+/g, " ");
  return { before: (start > 18 ? "…" : "") + before, after: after + (end + 18 < text.length ? "…" : "") };
}

export function ContentEditor({
  draftId,
  initialText,
  initialSpecs,
  customerType,
  customerTypeText,
  government,
  pledge,
  pledgeTemplateHref,
  backHref,
  fromReview = false,
  signature,
  signatureEditHref,
  senderName,
  initiallyKept = false,
}: {
  draftId: string;
  initialText: string;
  initialSpecs: VariableSpec[];
  customerType: string | null;
  customerTypeText: string;
  government: boolean;
  pledge: Pledge;
  pledgeTemplateHref: string;
  backHref: string;
  /** فُتحت من صفحة المراجعة: «التالي» يصبح «حفظ والعودة إلى المراجعة» */
  fromReview?: boolean;
  /** Client Name: سطر أخير ثابت عند نوع المرسل «توعوي» */
  signature: string | null;
  signatureEditHref: string;
  /** اسم المرسل فوق المعاينة */
  senderName: string;
  /** حُفظ مسبقاً بـ«حفظ والعودة لاحقاً» (keepDraft) */
  initiallyKept?: boolean;
}) {
  const start = useMemo(() => normalizeTemplate(initialText, initialSpecs), [initialText, initialSpecs]);
  const [text, setText] = useState(start.text);
  const [specs, setSpecs] = useState<VariableSpec[]>(start.specs);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);

  const [saveState, saveAction, saving] = useActionState(saveContentAction.bind(null, draftId), initialState);
  const [pledgeState, pledgeAction, uploading] = useActionState(uploadPledgeAction.bind(null, draftId), initialState);
  const [removeState, removeAction, removing] = useActionState(removePledgeAction.bind(null, draftId), initialState);
  const [pledgeFile, setPledgeFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();

  const tokens = useMemo(() => findTokens(text), [text]);
  // النص المعروض في المربع: مع علامة اتجاه قبل كل متغير (لا تُحفظ)
  const display = useMemo(() => markTokens(text), [text]);
  const [renderTick, forceRender] = useReducer((x: number) => x + 1, 0);
  const live = useMemo(
    () => evaluateTemplate({ text, signature, variables: specs, customerType, hasPledge: !!pledge }),
    [text, signature, specs, customerType, pledge],
  );

  // ما يتحقق يظهر فوراً، أما الإخفاق فينتظر توقف الكتابة (أو مغادرة المربع)
  // حتى لا تتحول الشروط إلى «غير محقق» في منتصف الجملة.
  const [settledText, setSettledText] = useState(text);
  useEffect(() => {
    const id = window.setTimeout(() => setSettledText(text), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [text]);
  const settled = useMemo(
    () => (settledText === text ? live : evaluateTemplate({ text: settledText, signature, variables: specs, customerType, hasPledge: !!pledge })),
    [settledText, text, live, signature, specs, customerType, pledge],
  );
  const rules = useMemo(() => {
    const before = new Map(settled.rules.map((r) => [r.id, r]));
    return live.rules.map((r) => (r.status === "pass" ? r : (before.get(r.id) ?? r)));
  }, [live, settled]);

  // الحفظ التلقائي: النص والمتغيرات كما هي، دون اشتراط تحقق الشروط
  const snapshot = useMemo(() => JSON.stringify({ text, specs }), [text, specs]);
  const autosave = useAutosave({
    snapshot,
    leaveMessage: t("autosave.leaveConfirm"),
    save: (snap) => {
      const s = JSON.parse(snap) as { text: string; specs: VariableSpec[] };
      const fd = new FormData();
      fd.set("content", s.text);
      fd.set("variables", JSON.stringify(s.specs));
      return saveContentDraftAction(draftId, initialState, fd);
    },
  });
  // «حفظ والعودة لاحقاً»: رسالة النجاح تبقى ما دام النص لم يتغير بعد الحفظ
  const [drafting, setDrafting] = useState(false);
  const [savedLater, setSavedLater] = useState<string | null>(null);
  const [kept, setKept] = useState(initiallyKept);
  const showSavedLater = savedLater === snapshot && !autosave.dirty;
  const busy = saving || drafting;

  // إعادة المؤشر لمكانه بعد إعادة ترقيم المتغيرات أو الإدراج
  useLayoutEffect(() => {
    if (caret.current === null || !areaRef.current) return;
    const pos = Math.min(markedIndex(text, caret.current), areaRef.current.value.length);
    areaRef.current.setSelectionRange(pos, pos);
    caret.current = null;
  }, [text, renderTick]);

  /** موضع المؤشر في المربع ← موضعه في النص المحفوظ (بدون علامات الاتجاه). */
  const cleanIndex = (value: string, pos: number) => cleanTemplateText(value.slice(0, pos)).length;

  function apply(raw: string, cursor: number | null) {
    const n = normalizeTemplate(raw, specs);
    if (cursor !== null) caret.current = Math.max(0, cursor + (n.text.length - raw.length));
    setText(n.text);
    setSpecs(n.specs);
  }

  function onType(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    let cleaned = cleanTemplateText(value);
    let cursor = cleanIndex(value, e.target.selectionStart);
    if (cleaned === text && value !== display) {
      // حُذفت علامة الاتجاه غير المرئية فقط: نحذف الحرف الظاهر المجاور بدلاً منها
      const kind = (e.nativeEvent as InputEvent).inputType;
      if (kind === "deleteContentBackward" && cursor > 0) {
        cleaned = text.slice(0, cursor - 1) + text.slice(cursor);
        cursor -= 1;
      } else if (kind === "deleteContentForward") {
        cleaned = text.slice(0, cursor) + text.slice(cursor + 1);
      }
    }
    apply(cleaned, cursor);
    forceRender();
  }

  function insertVariable() {
    const el = areaRef.current;
    const s = el ? cleanIndex(el.value, el.selectionStart) : text.length;
    const e = el ? cleanIndex(el.value, el.selectionEnd) : text.length;
    const before = text.slice(0, s);
    const after = text.slice(e);
    // مسافة قبل المتغير وبعده (النص لا ينتهي بمتغير، فالكتابة تستمر بعده دائماً)
    const piece = `${before && !/\s$/.test(before) ? " " : ""}${tokenText(tokens.length + 1)}${/^\s/.test(after) ? "" : " "}`;
    apply(before + piece + after, before.length + piece.length);
    el?.focus();
  }

  function removeVariable(i: number) {
    const tok = tokens[i];
    if (!tok) return;
    let before = text.slice(0, tok.start);
    let after = text.slice(tok.end);
    if (/ $/.test(before) && /^ /.test(after)) after = after.slice(1);
    else if (!before.trim()) after = after.replace(/^ +/, "");
    else if (!after.trim()) before = before.replace(/ +$/, "");
    apply(before + after, null);
  }

  const setSpec = (i: number, patch: Partial<VariableSpec>) => setSpecs((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  function payload() {
    const fd = new FormData();
    fd.set("content", text);
    fd.set("variables", JSON.stringify(specs));
    return fd;
  }
  const next = () => startTransition(() => saveAction(payload()));
  async function saveDraft() {
    setDrafting(true);
    // يحفظ آخر التغييرات ثم يعلّم المسودة «للعودة لاحقاً» حتى لا تُحذف عند الخروج
    let ok = await autosave.flush();
    if (ok) {
      try {
        ok = !(await keepDraftAction(draftId)).error;
        if (ok) setKept(true);
      } catch {
        ok = false;
      }
    }
    setDrafting(false);
    if (ok) setSavedLater(snapshot);
  }
  function upload() {
    if (!pledgeFile) return;
    const fd = new FormData();
    fd.set("pledge", pledgeFile);
    startTransition(() => pledgeAction(fd));
    setPledgeFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // الطول يشمل السطر الثابت لأنه جزء من الرسالة
  const length = charCount(composeMessage(text, signature).trim());
  // أجزاء SMS للرسالة كما تُرسل، والمتغيرات بأطوالها القصوى
  const sms = estimateSms(composeMessage(text, signature).trim(), specs);
  const blocking = (r: RuleResult) => r.status === "fail" || r.status === "pending";
  const open = rules.filter((r) => r.status !== "pass");
  const passed = rules.filter((r) => r.status === "pass");
  const failing = rules.filter(blocking).length;
  const counted = rules.length;
  const allMet = failing === 0;
  // ما يُعلَن لقارئ الشاشة: الحالة بعد التوقف فقط
  const settledMet = counted - settled.rules.filter(blocking).length;
  const showPledge = government && (settled.exceptions.length > 0 || !!pledge);
  const addDisabled = !government && tokens.length >= MAX_VARIABLES;
  const stats = live.stats;
  const ratio = stats.staticRatio;
  const maxLength = stats.variablesLength === null ? null : stats.staticLength + stats.variablesLength;
  const rows = 4 + (showPledge ? 1 : 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" style={{ "--rows": rows } as React.CSSProperties}>
      {/* ---------------- المحرر ---------------- */}
      <section aria-labelledby="content-title" className={`${card} lg:col-start-1`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="content-title" className="text-lg font-bold">
            {t("content.title")}
          </h2>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] ${government ? "bg-info-50 text-info-700" : "bg-chip text-ink-2"}`}
          >
            <span dir="ltr" className="opacity-75">
              Customer Type
            </span>
            <span className="font-semibold">{customerTypeText}</span>
          </span>
        </div>
        {government ? (
          <p className="rounded-xl bg-info-25 px-3.5 py-2.5 text-[13px] leading-6 text-info-700">
            {t("content.govBanner")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={insertVariable}
            disabled={addDisabled}
            className={buttonClass("outline")}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("content.addVar")}
          </button>
          <span className="text-[13px] leading-6 text-muted">
            {addDisabled ? (
              t("content.maxReached")
            ) : (
              <>
                {t("content.addHint")} <span dir="ltr" className="font-mono">{tokenText(1)}</span>
              </>
            )}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="template-content" className="sr-only">
            {t("content.title")}
          </label>
          <textarea
            id="template-content"
            ref={areaRef}
            value={display}
            onChange={onType}
            onBlur={() => setSettledText(text)}
            rows={7}
            dir="auto"
            placeholder={t("content.placeholder")}
            aria-describedby={signature ? "content-signature content-count" : "content-count"}
            className={`w-full border bg-white px-3.5 py-3 text-base leading-8 ${signature ? "rounded-t-xl" : "rounded-xl"} ${
              length > TEMPLATE_MAX_LENGTH ? "border-danger-600" : "border-field"
            }`}
          />
          {signature ? (
            <div
              id="content-signature"
              className="-mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-b-xl border border-t-0 border-dashed border-field bg-canvas px-3.5 py-2.5"
            >
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-muted">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span className="text-base font-semibold" data-testid="signature-line">
                {signature}
              </span>
              <span className="text-[13px] text-muted">
                {t("content.signatureNote")}{" "}
                <Link href={signatureEditHref} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
                  {t("content.editName")}
                </Link>
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <SaveStatus status={autosave.status} onRetry={() => void autosave.flush()} kept={kept} />
            <p id="content-count" className="ms-auto flex flex-wrap items-baseline justify-end gap-x-2 text-[13px] text-muted">
              <span dir="ltr" className={length > TEMPLATE_MAX_LENGTH ? "font-semibold text-danger-600" : undefined}>
                {length} / {TEMPLATE_MAX_LENGTH}
              </span>
              {sms.parts > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={sms.parts > 1 ? "font-semibold text-ink-2" : undefined}>
                    {t("content.smsParts", { n: sms.parts, per: sms.perPart })}
                    {sms.complete ? null : <span className="text-muted"> {t("content.smsEstimate")}</span>}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* على الجوال قائمة الشروط أسفل الصفحة: ملخص قصير هنا مع رابط إليها */}
        <a
          href="#rules"
          className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3.5 text-sm font-semibold lg:hidden ${
            allMet ? "bg-brand-50 text-brand-700" : "bg-canvas text-ink-2"
          }`}
        >
          {allMet ? t("content.allMet") : t("content.rulesOpen", { n: failing })}
          <span className="text-[13px] underline underline-offset-4">{t("content.rulesView")}</span>
        </a>
      </section>

      {/* ---------------- المتغيرات ---------------- */}
      <section aria-labelledby="vars-title" className={`${card} lg:col-start-1`}>
        <div className="flex flex-col gap-1">
          <h2 id="vars-title" className="text-lg font-bold">
            {t("content.varsTitle")}
          </h2>
          <p className="text-[13px] leading-6 text-muted">
            {government ? t("content.varsIntro") : t("content.varsIntroMax", { max: MAX_VARIABLE_LENGTH })}
          </p>
        </div>
        {tokens.length === 0 ? (
          <p className="rounded-xl bg-canvas px-3.5 py-3 text-sm text-muted">{t("content.noVars")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tokens.map((tok, i) => {
              const spec = specs[i] ?? { type: null, length: null };
              const ctx = contextOf(text, tok.start, tok.end);
              const typeId = `var-${i}-type`;
              const lenId = `var-${i}-length`;
              return (
                <li key={i} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span dir="ltr" className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-sm font-semibold text-brand-700">
                        {tokenText(i + 1)}
                      </span>
                      <span className="truncate text-[13px] text-muted">
                        <WithTokens text={ctx.before} />
                        <span className="font-semibold text-ink">■</span>
                        <WithTokens text={ctx.after} />
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariable(i)}
                      className="inline-flex min-h-11 sm:min-h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold text-danger-700 hover:bg-danger-50"
                      aria-label={t("content.removeVar", { name: tokenText(i + 1) })}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={typeId} className="text-[13px] font-semibold">
                        {t("content.varType")}
                      </label>
                      <select
                        id={typeId}
                        value={spec.type ?? ""}
                        onChange={(e) => setSpec(i, { type: (e.target.value || null) as VariableType | null })}
                        aria-invalid={!spec.type}
                        className={`h-11 w-full rounded-xl border bg-white px-3 text-[15px] ${spec.type ? "border-field" : "border-warn-600"}`}
                      >
                        <option value="">{t("content.chooseType")}</option>
                        {VARIABLE_TYPES.map((v) => (
                          <option key={v.value} value={v.value}>
                            {t(v.key)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={lenId} className="text-[13px] font-semibold">
                        {t("content.maxLen")}
                      </label>
                      <input
                        id={lenId}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={government ? VARIABLE_LENGTH_CEILING : MAX_VARIABLE_LENGTH}
                        step={1}
                        dir="ltr"
                        value={spec.length ?? ""}
                        onChange={(e) => setSpec(i, { length: e.target.value === "" ? null : Number(e.target.value) })}
                        aria-invalid={!spec.length}
                        className={`h-11 w-full rounded-xl border bg-white px-3 font-mono text-[15px] ${
                          spec.length && (government || spec.length <= MAX_VARIABLE_LENGTH) ? "border-field" : "border-warn-600"
                        }`}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------------- خطاب التعهد ---------------- */}
      {showPledge ? (
        <section aria-labelledby="pledge-title" className={`${card} border-info-200 lg:col-start-1`}>
          <div className="flex flex-col gap-1">
            <h2 id="pledge-title" className="text-lg font-bold">
              {t("content.pledgeTitle")}
            </h2>
            {settled.exceptions.length ? (
              <p className="text-[13px] leading-6 text-ink-2">
                {t("content.pledgeNeeded", { list: settled.exceptions.map((e) => exceptionLabel(t, e)) })}
              </p>
            ) : (
              <p className="text-[13px] leading-6 text-muted">{t("content.pledgeNotNeeded")}</p>
            )}
          </div>

          {pledgeState.error ? <Alert>{pledgeState.error}</Alert> : null}
          {removeState.error ? <Alert>{removeState.error}</Alert> : null}

          <ol className="flex flex-col gap-4">
            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t("content.pledgeStep1")}</span>
              <div>
                <a href={pledgeTemplateHref} data-no-guard className={buttonClass("secondary")}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
                  </svg>
                  {t("content.pledgeDownload")}
                </a>
              </div>
              <span className="text-[13px] text-muted">{t("content.pledgePrefilled")}</span>
            </li>
            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t("content.pledgeStep2")}</span>
              {pledge ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-50 px-3.5 py-2.5">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-brand-700">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  <a href={pledge.href} data-no-guard dir="auto" className="min-w-0 break-all text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
                    {pledge.fileName}
                  </a>
                  <span dir="ltr" className="text-[13px] text-muted">
                    {kb(pledge.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startTransition(() => removeAction())}
                    disabled={removing}
                    className="ms-auto inline-flex min-h-11 sm:min-h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold text-danger-700 hover:bg-white"
                  >
                    {removing ? t("common.deleting") : t("common.delete")}
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="pledge-file" className="sr-only">
                  {t("content.pledgeFile")}
                </label>
                <input
                  id="pledge-file"
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setPledgeFile(e.target.files?.[0] ?? null)}
                  className="max-w-full text-sm file:me-3 file:min-h-10 file:rounded-xl file:border file:border-field file:bg-white file:px-3.5 file:text-sm file:font-semibold"
                />
                <button
                  type="button"
                  onClick={upload}
                  disabled={!pledgeFile || uploading}
                  className={buttonClass("primary")}
                >
                  {uploading ? t("content.uploading") : pledge ? t("content.replacePledge") : t("content.uploadPledge")}
                </button>
              </div>
              <span className="text-[13px] text-muted">{t("content.pledgeFormats")}</span>
            </li>
          </ol>
        </section>
      ) : null}

      {/* ---------------- الشروط ----------------
          في الصفحة بعد المتغيرات (الجوال وقارئ الشاشة)، وعلى الشاشات الواسعة عمود جانبي ثابت بجانب المحرر. */}
      <aside
        id="rules"
        aria-labelledby="rules-title"
        className={`${card} scroll-mt-24 gap-3 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start lg:[grid-row-end:span_var(--rows)]`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="rules-title" className="text-lg font-bold">
            {t("content.rulesTitle")}
          </h2>
          <span
            aria-hidden="true"
            className={`rounded-full px-3 py-1 text-[13px] font-semibold ${allMet ? "bg-brand-50 text-brand-700" : "bg-chip text-ink-2"}`}
          >
            {allMet ? t("content.allMet") : t("content.metOf", { met: counted - failing, total: counted })}
          </span>
          <span aria-live="polite" className="sr-only">
            {settledMet === counted ? t("content.allMet") : t("content.metOfSr", { met: settledMet, total: counted })}
          </span>
        </div>

        {open.length ? (
          <>
            <p className="text-[13px] leading-6 text-muted">{t("content.rulesLive")}</p>
            <ul className="flex flex-col divide-y divide-hair">
              {open.map((r) => (
                <RuleItem key={r.id} r={r} />
              ))}
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-3 text-sm font-semibold text-brand-700">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
            {t("content.allMetLead")}
          </p>
        )}

        {passed.length ? (
          <details className="group border-t border-hair pt-1">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-sm font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
              {t("content.passedRules", { n: passed.length })}
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-muted transition-transform group-open:rotate-180">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <ul className="flex flex-col divide-y divide-hair">
              {passed.map((r) => (
                <RuleItem key={r.id} r={r} />
              ))}
            </ul>
          </details>
        ) : null}
      </aside>

      {/* ---------------- المعاينة ---------------- */}
      <section aria-labelledby="preview-title" className={`${card} lg:col-start-1`}>
        <h2 id="preview-title" className="text-lg font-bold">
          {t("content.previewTitle")}
        </h2>
        <div className="rounded-xl bg-canvas px-4 py-5">
          <MessageBubble sender={senderName}>
            <TemplatePreview text={text.trim()} specs={specs} signature={signature} />
          </MessageBubble>
        </div>
        {text.trim() ? (
          <div className="flex flex-col gap-2">
            {ratio !== null ? (
              <>
                <div className="relative h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <div
                    className={`h-full rounded-full ${ratio >= 0.6 ? "bg-brand-600" : government ? "bg-info-700" : "bg-danger-600"}`}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                  <div className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ insetInlineStart: "60%" }} />
                </div>
                <p className="text-[13px] text-ink-2">
                  {t("content.ratioLine", { staticPct: Math.round(ratio * 100), varPct: Math.round((1 - ratio) * 100) })}
                </p>
              </>
            ) : null}
            <p className="text-[13px] text-muted">
              {t("content.staticLen", { n: stats.staticLength })}
              {maxLength !== null && stats.variableCount ? t("content.maxMsgLen", { n: maxLength }) : ""}
            </p>
          </div>
        ) : null}
      </section>

      {/* ---------------- الأزرار ---------------- */}
      <div className="flex flex-col gap-3 lg:col-start-1">
        {saveState.error ? <Alert tone={saveState.tone ?? "error"}>{saveState.error}</Alert> : null}
        {showSavedLater ? <Alert tone="success">{t("req.ok.draftSaved")}</Alert> : null}
        <StepFooter backHref={backHref} backLabel={fromReview ? t("review.back") : t("common.previous")}>
          <button type="button" onClick={() => void saveDraft()} disabled={busy} className={buttonClass("secondary")}>
            {drafting ? t("common.saving") : t("content.saveLater")}
          </button>
          <button type="button" onClick={next} disabled={busy} className={`${buttonClass("primary")} sm:min-w-32`}>
            {saving ? t("common.saving") : fromReview ? t("review.save") : t("common.next")}
          </button>
        </StepFooter>
        {!allMet ? <p className="text-[13px] text-muted">{t("content.remaining", { n: failing })}</p> : null}
        {/* غير المحفوظ للعودة لاحقاً يُحذف عند تسجيل الخروج أو بدء طلب جديد */}
        <p className={`flex items-start gap-2 text-[13px] leading-6 ${kept ? "text-brand-700" : "text-muted"}`}>
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 flex-none">
            {kept ? <path d="M5 12l5 5L20 7" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>}
          </svg>
          {kept ? t("content.keptNote") : t("content.saveLaterNote")}
        </p>
      </div>
    </div>
  );
}

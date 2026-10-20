"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ReviewStatus } from "@/generated/prisma/enums";

/*
 * حركة تغيّر حالة الطلب، وأهمها «لدى الهيئة» ← «مقبول»/«مرفوض».
 * الأنماط في globals.css (motion-*، data-news، data-just-changed) ولكل منها بديل لتقليل الحركة.
 * المحتوى ظاهر دائماً في حالته النهائية؛ الحركة تضاف فوقه ولا تخفي شيئاً إن لم تعمل.
 */

const DECIDED: ReviewStatus[] = ["APPROVED", "REJECTED"];
const isDecided = (s: ReviewStatus | null | undefined) => !!s && DECIDED.includes(s);
const ringColor = (s: ReviewStatus) => (s === "REJECTED" ? "rgb(168 34 26 / 0.4)" : "rgb(34 128 78 / 0.45)");

type Labels = Record<ReviewStatus, string>;

/**
 * شارة الحالة في صفحة الطلب (الإدارة): عند حفظ حالة جديدة تخرج القديمة للأعلى وتدخل الجديدة،
 * ويتبدل اللون، وتستقر شارة القرار بحلقة واحدة.
 */
export function StatusBadge({
  status,
  labels,
  styles,
  className = "",
}: {
  status: ReviewStatus;
  labels: Labels;
  styles: Record<ReviewStatus, string>;
  className?: string;
}) {
  const prev = useRef(status);
  const [leaving, setLeaving] = useState<ReviewStatus | null>(null);
  const [changes, setChanges] = useState(0);

  useLayoutEffect(() => {
    if (prev.current === status) return;
    setLeaving(prev.current);
    setChanges((n) => n + 1);
    prev.current = status;
    const id = window.setTimeout(() => setLeaving(null), 200);
    return () => window.clearTimeout(id);
  }, [status]);

  return (
    <span
      key={changes}
      data-testid="review-status"
      style={isDecided(status) ? ({ "--decision-ring": ringColor(status) } as React.CSSProperties) : undefined}
      className={`relative inline-grid overflow-hidden rounded-full transition-colors duration-300 ${styles[status]} ${
        changes > 0 && isDecided(status) ? "motion-decision" : ""
      } ${className}`}
    >
      {leaving ? (
        <span aria-hidden="true" className="motion-status-out col-start-1 row-start-1">
          {labels[leaving]}
        </span>
      ) : null}
      <span className={`col-start-1 row-start-1 ${changes > 0 ? "motion-status-in" : ""}`}>{labels[status]}</span>
    </span>
  );
}

// أول عنصر يُركَّب في الصفحة؛ ما يُركَّب بعده بأكثر من ثانية جاء من تحديث (حالة جديدة) فيُكشف بحركة
let firstMountAt = 0;

/** سجل الحالات (الإدارة): الإدخال الجديد بعد الحفظ ينفتح في مكانه مع تظليل يتلاشى. */
export function RevealOnUpdate({ children }: { children: ReactNode }) {
  const [isNew, setIsNew] = useState(false);
  useLayoutEffect(() => {
    const now = performance.now();
    if (!firstMountAt) firstMountAt = now;
    else if (now - firstMountAt > 1000) setIsNew(true);
  }, []);
  if (!isNew) return <>{children}</>;
  return (
    <div className="motion-reveal">
      <div className="motion-tint -mx-2 rounded-lg px-2">{children}</div>
    </div>
  );
}

const LAST_CHANGE_KEY = "tdr:lastStatusChange";
type LastChange = { id: string; from: ReviewStatus | null; to: ReviewStatus; at: number };

/** يحفظ آخر تغيير للحالة في هذه الجلسة لتُبرزه قائمة الطلبات عند العودة إليها. */
export function rememberStatusChange(change: Omit<LastChange, "at">) {
  try {
    sessionStorage.setItem(LAST_CHANGE_KEY, JSON.stringify({ ...change, at: Date.now() }));
  } catch {
    // التخزين غير متاح: يبقى التغيير ظاهراً في القائمة بدون إبراز
  }
}

/**
 * في خانة حالة كل صف من قائمة الطلبات: إن كان هذا الطلب آخر ما غيّره المشرف (خلال 10 دقائق)
 * يُظلَّل الصف ويظهر «كانت: …» لثوانٍ، وتنبض شارة عدّاد الحالة الجديدة. يُعرض مرة واحدة.
 */
export function RecentChangeNote({ id, status, labels, wasLabel }: { id: string; status: ReviewStatus | null; labels: Labels; wasLabel: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [from, setFrom] = useState<ReviewStatus | null>(null);

  useEffect(() => {
    let change: LastChange | null = null;
    try {
      change = JSON.parse(sessionStorage.getItem(LAST_CHANGE_KEY) ?? "null") as LastChange | null;
    } catch {
      return;
    }
    if (!change || change.id !== id || change.to !== status || Date.now() - change.at > 10 * 60_000) return;
    try {
      sessionStorage.removeItem(LAST_CHANGE_KEY);
    } catch {
      /* لا شيء */
    }
    const row = ref.current?.closest("tr");
    row?.setAttribute("data-just-changed", "");
    const chip = document.querySelector<HTMLElement>(`[data-chip="${change.to}"]`);
    if (chip) {
      chip.style.setProperty("--decision-ring", ringColor(change.to));
      chip.setAttribute("data-pulse", "");
    }
    setFrom(change.from);
  }, [id, status]);

  return (
    <span ref={ref} className="block">
      {from ? (
        <span className="motion-note mt-1 block whitespace-nowrap text-meta text-muted">{wasLabel.replace("{status}", labels[from])}</span>
      ) : null}
    </span>
  );
}

/**
 * متابعة العميل: إن تغيّرت حالة الطلب إلى قرار منذ زيارته الأخيرة لهذه الصفحة
 * يمتلئ خط «لدى الهيئة → القرار» وتستقر عقدة القرار، مع سطر «تحديث منذ زيارتك الأخيرة».
 * آخر حالة رآها العميل محفوظة في المتصفح فقط (تفضيل للعرض، لا بيانات).
 */
export function TrackerNews({
  requestId,
  status,
  labels,
  template,
}: {
  requestId: string;
  status: ReviewStatus;
  labels: Labels;
  /** «… {from} … {to}» */
  template: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [seen, setSeen] = useState<ReviewStatus | null>(null);

  useEffect(() => {
    const key = `tdr:seen:${requestId}`;
    let before: ReviewStatus | null = null;
    try {
      before = localStorage.getItem(key) as ReviewStatus | null;
      localStorage.setItem(key, status);
    } catch {
      return;
    }
    if (before && before !== status && isDecided(status) && !isDecided(before)) {
      ref.current?.closest("section")?.setAttribute("data-news", "");
      setSeen(before);
    }
  }, [requestId, status]);

  if (!seen) return <p ref={ref} hidden />;
  return (
    <p ref={ref} role="status" className={`rounded-xl px-3.5 py-2.5 text-meta font-semibold ${status === "REJECTED" ? "bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-700"}`}>
      {template.replace("{from}", labels[seen]).replace("{to}", labels[status])}
    </p>
  );
}

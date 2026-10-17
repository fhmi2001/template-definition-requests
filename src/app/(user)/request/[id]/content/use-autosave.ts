"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type AutosaveStatus =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string | null };

type SaveResult = { ok?: boolean; error?: string };

/**
 * حفظ تلقائي لعمل العميل في المرحلة 4.
 * - snapshot: تمثيل نصي للحالة الحالية؛ أي تغيير فيه يعني تغييرات غير محفوظة.
 * - يُحفظ بعد توقف الكتابة (delay)، وعند إخفاء الصفحة، وقبل اتباع أي رابط داخلي.
 * - المغادرة بإغلاق الصفحة أو تحديثها مع تغييرات غير محفوظة تطلب تأكيد المتصفح.
 */
export function useAutosave({
  snapshot,
  save,
  leaveMessage,
  delay = 1500,
}: {
  snapshot: string;
  save: (snapshot: string) => Promise<SaveResult>;
  /** يظهر عند فشل الحفظ قبل الانتقال لصفحة أخرى */
  leaveMessage: string;
  delay?: number;
}) {
  const router = useRouter();
  const saved = useRef(snapshot); // آخر حالة محفوظة في الخادم
  const latest = useRef(snapshot);
  const saveRef = useRef(save);
  const leaveRef = useRef(leaveMessage);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const [status, setStatus] = useState<AutosaveStatus>({ kind: "idle" });

  useLayoutEffect(() => {
    latest.current = snapshot;
    saveRef.current = save;
    leaveRef.current = leaveMessage;
  });

  /** يحفظ الآن إن وُجدت تغييرات؛ يعيد true إذا أصبح كل شيء محفوظاً. */
  const flush = useCallback(async (): Promise<boolean> => {
    while (inFlight.current) await inFlight.current;
    if (latest.current === saved.current) return true;

    const sending = latest.current;
    setStatus({ kind: "saving" });
    const run = (async () => {
      try {
        const res = await saveRef.current(sending);
        if (res.error) {
          setStatus({ kind: "error", message: res.error });
          return false;
        }
        saved.current = sending;
        setStatus(latest.current === sending ? { kind: "saved", at: new Date() } : { kind: "dirty" });
        return true;
      } catch {
        // انقطاع الشبكة أو خطأ في الخادم: يبقى النص في الصفحة
        setStatus({ kind: "error", message: null });
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  // الحفظ بعد توقف الكتابة
  useEffect(() => {
    if (snapshot === saved.current) return;
    setStatus((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
    const id = window.setTimeout(() => void flush(), delay);
    return () => window.clearTimeout(id);
  }, [snapshot, delay, flush]);

  // حراسة المغادرة
  useEffect(() => {
    const isDirty = () => latest.current !== saved.current || inFlight.current !== null;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };

    // الجوال: الانتقال لتطبيق آخر قد يكون آخر فرصة للحفظ
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && isDirty()) void flush();
    };

    // روابط داخلية (السابق، شريط المراحل، تغيير المرسل، التنقل العلوي): نحفظ أولاً ثم ننتقل.
    // في مرحلة الالتقاط على window حتى يسبق معالج Link في React.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!isDirty()) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download") || "noGuard" in a.dataset) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // beforeunload يتولى الروابط الخارجية
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      e.preventDefault();
      e.stopPropagation();
      void flush().then((ok) => {
        if (ok || window.confirm(leaveRef.current)) router.push(url.pathname + url.search + url.hash);
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("click", onClick, true);
    };
  }, [flush, router]);

  return { status, flush, dirty: snapshot !== saved.current || status.kind === "saving" };
}

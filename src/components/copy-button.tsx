"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";

/** نسخ نص كامل إلى الحافظة، مع بديل للمتصفحات التي لا تتيح Clipboard API (مثل http). */
async function copy(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ننتقل للطريقة البديلة
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const id = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(id);
  }, [state]);

  return (
    <button
      type="button"
      onClick={async () => setState((await copy(text)) ? "done" : "error")}
      aria-label={label ?? t("copy.label")}
      className={`inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors ${
        state === "done" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-field bg-white text-ink hover:bg-canvas"
      }`}
    >
      {state === "done" ? (
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l5 5L20 7" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      )}
      <span aria-live="polite">{state === "done" ? t("copy.done") : state === "error" ? t("copy.error") : t("copy.button")}</span>
    </button>
  );
}

"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { useT } from "@/i18n/client";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className,
  ...rest
}: ComponentProps<"button"> & { pendingText?: string; variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      aria-disabled={pending || rest.disabled}
      className={cx(buttonClass(variant), className)}
      {...rest}
    >
      {pending ? (pendingText ?? t("common.working")) : children}
    </button>
  );
}

export function buttonClass(variant: "primary" | "secondary" | "danger" | "ghost" = "primary") {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "border border-field bg-white text-ink hover:bg-canvas",
    danger: "bg-danger-600 text-white hover:bg-danger-700",
    ghost: "text-ink hover:bg-canvas",
  } as const;
  return cx(base, styles[variant]);
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] leading-relaxed text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function inputClass(hasError?: boolean) {
  return cx(
    "h-12 w-full rounded-[10px] border bg-white px-3.5 text-base text-ink",
    hasError ? "border-danger-600" : "border-field",
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "warning" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "bg-danger-50 text-danger-700",
    warning: "bg-warn-50 text-warn-700",
    info: "bg-[#e9ece8] text-[#3f4945]",
    success: "bg-brand-50 text-brand-700",
  } as const;
  return (
    <div role={tone === "success" || tone === "info" ? "status" : "alert"} className={cx("rounded-[10px] px-3.5 py-3 text-sm leading-relaxed", styles[tone])}>
      {children}
    </div>
  );
}

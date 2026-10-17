"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { useT } from "@/i18n/client";
import { buttonClass, cx, type ButtonVariant } from "./button-styles";

export { inputClass } from "./button-styles";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className,
  ...rest
}: ComponentProps<"button"> & { pendingText?: string; variant?: ButtonVariant }) {
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


export function Alert({ tone = "error", children }: { tone?: "error" | "warning" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "bg-danger-50 text-danger-700",
    warning: "bg-warn-50 text-warn-700",
    info: "bg-chip text-ink-2",
    success: "bg-brand-50 text-brand-700",
  } as const;
  return (
    <div role={tone === "success" || tone === "info" ? "status" : "alert"} className={cx("rounded-xl px-4 py-3 text-sm leading-relaxed", styles[tone])}>
      {children}
    </div>
  );
}

/** زر داخل form يطلب تأكيداً قبل الإرسال (للحذف والتعطيل). */
export function ConfirmButton({
  message,
  children,
  className,
  pendingText,
  variant = "secondary",
  disabled,
}: {
  message: string;
  children: ReactNode;
  className?: string;
  pendingText?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  return (
    <SubmitButton
      variant={variant}
      pendingText={pendingText}
      className={className}
      disabled={disabled}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </SubmitButton>
  );
}

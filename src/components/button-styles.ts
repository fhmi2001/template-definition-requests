/** أنماط الأزرار المشتركة: تُستخدم للأزرار والروابط بشكل زر (في مكونات الخادم والعميل). */

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-55";

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-[15px]",
  sm: "min-h-10 px-4 text-sm",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white shadow-[0_1px_0_rgb(0_0_0/0.08)] hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-field bg-white text-ink hover:border-field-strong hover:bg-canvas-2",
  outline: "border border-brand-600 bg-white text-brand-700 hover:bg-brand-50",
  danger: "bg-danger-600 text-white hover:bg-danger-700",
  ghost: "text-ink hover:bg-canvas",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return cx(BASE, SIZES[size], VARIANTS[variant]);
}

/** حقل إدخال نصي بنفس الارتفاع والحدود في كل الصفحات. */
export function inputClass(hasError?: boolean) {
  return cx(
    "h-12 w-full rounded-xl border bg-white px-3.5 text-base text-ink transition-colors hover:border-field-strong",
    hasError ? "border-danger-600" : "border-field",
  );
}

import type { ReactNode } from "react";

/**
 * الرسالة كما ستصل على جوال المستلم: اسم المرسل فوق فقاعة رسالة.
 * تُستخدم لمعاينة نص القالب ولنموذج المثال في صفحة الدخول.
 */
export function MessageBubble({
  sender,
  meta,
  children,
  className = "",
}: {
  sender?: string | null;
  /** سطر صغير تحت الفقاعة (مثل عدد الأحرف) */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      {sender ? (
        <figcaption className="flex items-center gap-2">
          <span aria-hidden="true" className="flex size-7 flex-none items-center justify-center rounded-full bg-brand-600 text-meta font-bold text-white">
            {sender.trim().charAt(0).toUpperCase()}
          </span>
          <span dir="ltr" className="font-mono text-meta font-semibold text-ink">
            {sender}
          </span>
        </figcaption>
      ) : null}
      <div
        dir="auto"
        className="relative max-w-full self-start rounded-[20px] rounded-ss-md border border-brand-200 bg-white px-4 py-3 text-body leading-8 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.04)]"
      >
        {children}
      </div>
      {meta ? <div className="text-meta text-muted">{meta}</div> : null}
    </figure>
  );
}

/** متغير داخل نص الرسالة (#Var1#) معزول باتجاه LTR. */
export function TokenChip({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <span
      dir="ltr"
      className="mx-0.5 inline-flex items-baseline gap-1 rounded-md bg-brand-50 px-1.5 align-baseline font-mono text-[0.85em] font-medium text-brand-700 ring-1 ring-inset ring-brand-200"
    >
      {children}
      {note}
    </span>
  );
}

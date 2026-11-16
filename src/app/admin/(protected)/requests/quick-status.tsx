"use client";

import { useId, useRef, useState } from "react";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { StatusForm } from "./[id]/review-forms";
import { buttonClass } from "@/components/button-styles";
import { useT } from "@/i18n/client";

/**
 * تغيير سريع للحالة بجانب كل طلب في القائمة: نافذة فيها نفس نموذج صفحة الطلب
 * (الحالات الأربع، ورقم القالب، وسبب الرفض، وخيار «بدون إشعار»). النموذج لا يُبنى إلا عند الفتح.
 */
export function QuickStatus({
  requestId,
  refText,
  current,
  authorityRef,
}: {
  requestId: string;
  refText: string;
  current: ReviewStatus | null;
  authorityRef: string | null;
}) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
        className={`${buttonClass("secondary", "sm")} whitespace-nowrap`}
      >
        {t("rq.quick.open")}
        <span className="sr-only"> {refText}</span>
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="m-auto max-h-[90vh] w-[min(94vw,520px)] overflow-y-auto rounded-2xl border border-line bg-white p-6 text-ink shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)] backdrop:bg-night/50"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-title font-bold">
            {t("rq.quick.title")} <span dir="ltr" className="font-mono">{refText}</span>
          </h2>
          <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass("ghost", "sm")}>
            {t("common.cancel")}
          </button>
        </div>
        {open ? <StatusForm requestId={requestId} current={current} authorityRef={authorityRef} onSaved={() => dialogRef.current?.close()} /> : null}
      </dialog>
    </>
  );
}

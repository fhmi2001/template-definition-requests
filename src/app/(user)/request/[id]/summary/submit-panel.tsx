"use client";

import Link from "next/link";
import { StepFooter } from "@/components/step-footer";
import { useActionState } from "react";
import { submitRequestAction } from "@/actions/requests";
import { initialState } from "@/lib/action-state";
import { Alert, ConfirmButton } from "@/components/ui";
import { useT } from "@/i18n/client";

/**
 * زر التقديم: يتحقق الخادم من كل المراحل مرة أخيرة قبل التقديم.
 * إن كان الطلب غير جاهز يظهر السبب ورابط إصلاحه فوق الزر المعطّل مباشرة،
 * لأن التنبيه أعلى الصفحة يبعد كثيراً عن الزر على الجوال.
 */
export function SubmitPanel({
  draftId,
  canSubmit,
  backHref,
  blocked,
}: {
  draftId: string;
  canSubmit: boolean;
  backHref: string;
  blocked?: { message: string; href: string } | null;
}) {
  const [state, action] = useActionState(submitRequestAction.bind(null, draftId), initialState);
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-3">
      {!canSubmit && blocked && !state.error ? (
        <p className="text-small text-ink-2 sm:text-end">
          {blocked.message}{" "}
          <Link href={blocked.href} className="font-semibold text-brand-700 underline underline-offset-4">
            {t("summary.fixStep")}
          </Link>
        </p>
      ) : null}
      {state.error ? (
        <Alert>
          {state.error}{" "}
          {state.values?.step ? (
            <Link href={state.values.step} className="font-semibold underline">
              {t("summary.goToStep")}
            </Link>
          ) : null}
        </Alert>
      ) : null}
      <StepFooter backHref={backHref} backLabel={t("common.previous")}>
        <ConfirmButton
          variant="primary"
          className="min-w-40"
          pendingText={t("summary.submitting")}
          disabled={!canSubmit}
          message={t("summary.confirm")}
        >
          {t("summary.submit")}
        </ConfirmButton>
      </StepFooter>
    </form>
  );
}

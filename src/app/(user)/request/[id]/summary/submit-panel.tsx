"use client";

import Link from "next/link";
import { StepFooter } from "@/components/step-footer";
import { useActionState } from "react";
import { submitRequestAction } from "@/actions/requests";
import { initialState } from "@/lib/action-state";
import { Alert, ConfirmButton } from "@/components/ui";
import { useT } from "@/i18n/client";

/** زر التقديم: يتحقق الخادم من كل المراحل مرة أخيرة قبل التقديم. */
export function SubmitPanel({ draftId, canSubmit, backHref }: { draftId: string; canSubmit: boolean; backHref: string }) {
  const [state, action] = useActionState(submitRequestAction.bind(null, draftId), initialState);
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-3">
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

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitRequestAction } from "@/actions/requests";
import { initialState } from "@/lib/action-state";
import { Alert } from "@/components/ui";
import { ConfirmButton } from "@/app/admin/(protected)/clients/client-forms";
import { backLinkClass } from "../../request-classes";
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Link href={backHref} className={backLinkClass}>
          {t("common.previous")}
        </Link>
        <ConfirmButton
          variant="primary"
          className="min-w-40"
          pendingText={t("summary.submitting")}
          disabled={!canSubmit}
          message={t("summary.confirm")}
        >
          {t("summary.submit")}
        </ConfirmButton>
      </div>
    </form>
  );
}

"use client";

import { useT } from "@/i18n/client";
import { useActionState } from "react";
import { applyClientImportAction, cancelClientImportAction } from "@/actions/client-imports";
import { initialState } from "@/lib/action-state";
import { Alert, ConfirmButton } from "@/components/ui";

/** أزرار تأكيد الاستيراد أو إلغائه. */
export function ImportDecision({ importId, confirmMessage, canApply }: { importId: string; confirmMessage: string; canApply: boolean }) {
  const [state, action] = useActionState(applyClientImportAction.bind(null, importId), initialState);
  const t = useT();

  return (
    <div className="flex flex-col gap-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-2">
        {canApply ? (
          <form action={action}>
            <ConfirmButton variant="primary" pendingText={t("ci.importing")} message={confirmMessage}>
              {t("ci.confirm")}
            </ConfirmButton>
          </form>
        ) : null}
        <form action={cancelClientImportAction.bind(null, importId)}>
          <ConfirmButton message={t("ci.cancelConfirm")}>{canApply ? t("common.cancel") : t("ci.closePreview")}</ConfirmButton>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSenderAction, updateSenderAction } from "@/actions/senders";
import { initialState } from "@/lib/action-state";
import { SENDER_NAME_RULE } from "@/lib/validation";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { useT } from "@/i18n/client";

/** إضافة مرسل يدوياً. */
export function CreateSenderForm() {
  const [state, action] = useActionState(createSenderAction, initialState);
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field id="new-sender" label={t("col.senderName")} error={state.fields?.name} hint={t.x(SENDER_NAME_RULE)}>
          <input
            id="new-sender"
            name="name"
            type="text"
            dir="ltr"
            maxLength={11}
            placeholder="SenderName"
            autoComplete="off"
            defaultValue={state.ok ? "" : (state.values?.name ?? "")}
            className={`${inputClass(!!state.fields?.name)} text-left font-mono`}
          />
        </Field>
        <Field id="new-sender-desc" label={<>{t("senders.description")} <span className="font-normal text-muted">{t("common.optional")}</span></>} error={state.fields?.description}>
          <input
            id="new-sender-desc"
            name="description"
            type="text"
            placeholder={t("senders.descPlaceholder")}
            defaultValue={state.ok ? "" : (state.values?.description ?? "")}
            className={inputClass(!!state.fields?.description)}
          />
        </Field>
      </div>
      <div>
        <SubmitButton pendingText={t("common.saving")}>{t("senders.addSubmit")}</SubmitButton>
      </div>
    </form>
  );
}

/** تعديل اسم المرسل ووصفه. */
export function EditSenderForm({
  senderId,
  name,
  description,
  linkedToExcel,
}: {
  senderId: string;
  name: string;
  description: string | null;
  linkedToExcel: boolean;
}) {
  const [state, action] = useActionState(updateSenderAction.bind(null, senderId), initialState);
  const t = useT();

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field
          id="edit-sender"
          label={t("col.senderName")}
          error={state.fields?.name}
          hint={linkedToExcel ? t("senders.excelCaseOnly") : t.x(SENDER_NAME_RULE)}
        >
          <input
            id="edit-sender"
            name="name"
            type="text"
            dir="ltr"
            maxLength={11}
            autoComplete="off"
            defaultValue={state.values?.name ?? name}
            className={`${inputClass(!!state.fields?.name)} text-left font-mono`}
          />
        </Field>
        <Field id="edit-sender-desc" label={<>{t("senders.description")} <span className="font-normal text-muted">{t("common.optional")}</span></>} error={state.fields?.description}>
          <input
            id="edit-sender-desc"
            name="description"
            type="text"
            defaultValue={state.values?.description ?? description ?? ""}
            className={inputClass(!!state.fields?.description)}
          />
        </Field>
      </div>
      <div>
        <SubmitButton pendingText={t("common.saving")}>{t("clients.saveChanges")}</SubmitButton>
      </div>
    </form>
  );
}

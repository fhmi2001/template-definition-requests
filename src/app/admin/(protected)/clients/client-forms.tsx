"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { addEmailsAction, createClientAction, linkSendersAction, updateClientAction } from "@/actions/clients";
import { initialState } from "@/lib/action-state";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { useT } from "@/i18n/client";

const textareaClass = (err?: boolean) =>
  `w-full rounded-[10px] border bg-white px-3.5 py-2.5 text-sm leading-6 ${err ? "border-danger-600" : "border-field"}`;

/** نموذج إضافة عميل جديد مع إيميلاته. */
export function CreateClientForm() {
  const [state, action] = useActionState(createClientAction, initialState);
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Field id="new-name" label={t("col.clientName")} error={state.fields?.name}>
          <input
            id="new-name"
            name="name"
            type="text"
            placeholder={t("clients.namePlaceholder")}
            defaultValue={state.ok ? "" : (state.values?.name ?? "")}
            className={inputClass(!!state.fields?.name)}
          />
        </Field>
        <Field id="new-notes" label={<>{t("clients.notes")} <span className="font-normal text-muted">{t("common.optional")}</span></>} error={state.fields?.notes}>
          <input
            id="new-notes"
            name="notes"
            type="text"
            defaultValue={state.ok ? "" : (state.values?.notes ?? "")}
            className={inputClass(!!state.fields?.notes)}
          />
        </Field>
      </div>

      <Field
        id="new-emails"
        label={t("login.email")}
        error={state.fields?.emails}
        hint={t("clients.emailsHint")}
      >
        <textarea
          id="new-emails"
          name="emails"
          dir="ltr"
          rows={3}
          placeholder={"user1@company.com\nuser2@company.com"}
          defaultValue={state.ok ? "" : (state.values?.emails ?? "")}
          className={`${textareaClass(!!state.fields?.emails)} text-left font-mono`}
        />
      </Field>

      <Field
        id="new-senders"
        label={<>{t("col.senders")} <span className="font-normal text-muted">{t("common.optional")}</span></>}
        error={state.fields?.senderNames}
        hint={t("clients.sendersHint")}
      >
        <textarea
          id="new-senders"
          name="senderNames"
          dir="ltr"
          rows={3}
          placeholder={"SenderName\nOtherSender"}
          defaultValue={state.ok ? "" : (state.values?.senderNames ?? "")}
          className={`${textareaClass(!!state.fields?.senderNames)} text-left font-mono`}
        />
      </Field>

      <div>
        <SubmitButton pendingText={t("common.saving")}>{t("clients.addSubmit")}</SubmitButton>
      </div>
    </form>
  );
}

/** تعديل اسم العميل وملاحظاته. */
export function EditClientForm({ clientId, name, notes }: { clientId: string; name: string; notes: string | null }) {
  const [state, action] = useActionState(updateClientAction.bind(null, clientId), initialState);
  const t = useT();

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="edit-name" label={t("col.clientName")} error={state.fields?.name}>
          <input
            id="edit-name"
            name="name"
            type="text"
            defaultValue={state.values?.name ?? name}
            className={inputClass(!!state.fields?.name)}
          />
        </Field>
        <Field id="edit-notes" label={<>{t("clients.notes")} <span className="font-normal text-muted">{t("common.optional")}</span></>} error={state.fields?.notes}>
          <input
            id="edit-notes"
            name="notes"
            type="text"
            defaultValue={state.values?.notes ?? notes ?? ""}
            className={inputClass(!!state.fields?.notes)}
          />
        </Field>
      </div>
      <div>
        <SubmitButton pendingText={t("common.saving")}>{t("clients.saveChanges")}</SubmitButton>
      </div>
    </form>
  );
}

/** إضافة بريد أو أكثر لعميل موجود. */
export function AddEmailsForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState(addEmailsAction.bind(null, clientId), initialState);
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <Field id="add-emails" label={t("clients.addEmail")} error={state.fields?.emails} hint={t("clients.addEmailHint")}>
        <textarea
          id="add-emails"
          name="emails"
          dir="ltr"
          rows={2}
          placeholder="name@company.com"
          defaultValue={state.ok ? "" : (state.values?.emails ?? "")}
          className={`${textareaClass(!!state.fields?.emails)} text-left font-mono`}
        />
      </Field>
      <div>
        <SubmitButton pendingText={t("common.adding")}>{t("common.add")}</SubmitButton>
      </div>
    </form>
  );
}

/** ربط اسم مرسل أو أكثر بعميل موجود. */
export function LinkSendersForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState(linkSendersAction.bind(null, clientId), initialState);
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <Field
        id="link-senders"
        label={t("clients.linkSender")}
        error={state.fields?.names}
        hint={t("clients.linkHint")}
      >
        <textarea
          id="link-senders"
          name="names"
          dir="ltr"
          rows={2}
          placeholder="SenderName"
          defaultValue={state.ok ? "" : (state.values?.names ?? "")}
          className={`${textareaClass(!!state.fields?.names)} text-left font-mono`}
        />
      </Field>
      <div>
        <SubmitButton pendingText={t("clients.linking")}>{t("clients.link")}</SubmitButton>
      </div>
    </form>
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
  variant?: "primary" | "secondary" | "danger" | "ghost";
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

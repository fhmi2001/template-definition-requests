"use client";

import { useActionState } from "react";
import { createAdminAction, resetAdminPasswordAction, toggleAdminStatusAction, updateAdminAction } from "@/actions/users";
import { initialState } from "@/lib/action-state";
import { Alert, ConfirmButton, Field, SubmitButton, inputClass } from "@/components/ui";
import { useT } from "@/i18n/client";

function PasswordFields({ fields }: { fields?: Record<string, string> }) {
  const t = useT();
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field id="password" label={t("users.f.password")} error={fields?.password} hint={t("users.f.passwordHint")}>
        <input id="password" name="password" type="password" autoComplete="new-password" dir="ltr" className={`${inputClass(!!fields?.password)} text-left`} />
      </Field>
      <Field id="confirm" label={t("users.f.confirm")} error={fields?.confirm}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" dir="ltr" className={`${inputClass(!!fields?.confirm)} text-left`} />
      </Field>
    </div>
  );
}

function RoleSelect({ value, error, disabled }: { value: string; error?: boolean; disabled?: boolean }) {
  const t = useT();
  return (
    <select id="role" name="role" defaultValue={value} disabled={disabled} className={inputClass(error)}>
      <option value="ADMIN">{t("admin.admin")}</option>
      <option value="SUPER_ADMIN">{t("admin.superAdmin")}</option>
    </select>
  );
}

function EmailField({ value, error }: { value: string; error?: string }) {
  const t = useT();
  return (
    <Field id="email" label={t("login.email")} error={error} hint={t("users.f.emailHint")}>
      <input id="email" name="email" type="email" dir="ltr" autoComplete="off" defaultValue={value} className={`${inputClass(!!error)} text-left font-mono`} />
    </Field>
  );
}

const optional = (label: string, opt: string) => (
  <>
    {label} <span className="font-normal text-muted">{opt}</span>
  </>
);

/** إضافة حساب إدارة: الاسم واسم المستخدم والدور وكلمة مرور أولية. */
export function NewAdminForm() {
  const [state, action] = useActionState(createAdminAction, initialState);
  const t = useT();
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="name" label={optional(t("users.f.name"), t("common.optional"))} error={state.fields?.name}>
          <input id="name" name="name" type="text" defaultValue={v.name ?? ""} className={inputClass(!!state.fields?.name)} />
        </Field>
        <Field id="username" label={t("users.f.username")} error={state.fields?.username} hint={t("users.f.usernameHint")}>
          <input id="username" name="username" type="text" dir="ltr" autoComplete="off" defaultValue={v.username ?? ""} className={`${inputClass(!!state.fields?.username)} text-left font-mono`} />
        </Field>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <EmailField value={v.email ?? ""} error={state.fields?.email} />
        <Field id="role" label={t("users.f.role")} error={state.fields?.role} hint={t("users.f.roleHint")}>
          <RoleSelect value={v.role ?? "ADMIN"} error={!!state.fields?.role} />
        </Field>
      </div>
      <PasswordFields fields={state.fields} />
      <p className="text-meta text-muted">{t("users.f.adminNote")}</p>
      <div>
        <SubmitButton pendingText={t("common.saving")}>{t("users.add")}</SubmitButton>
      </div>
    </form>
  );
}

/** تعديل الاسم والدور. لا يغيّر أحد دوره بنفسه. */
export function EditAdminForm({
  admin,
  canChangeRole,
}: {
  admin: { id: string; name: string | null; email: string | null; role: string };
  canChangeRole: boolean;
}) {
  const [state, action] = useActionState(updateAdminAction.bind(null, admin.id), initialState);
  const t = useT();
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="name" label={optional(t("users.f.name"), t("common.optional"))} error={state.fields?.name}>
          <input id="name" name="name" type="text" defaultValue={v.name ?? admin.name ?? ""} className={inputClass(!!state.fields?.name)} />
        </Field>
        <EmailField value={v.email ?? admin.email ?? ""} error={state.fields?.email} />
        <Field id="role" label={t("users.f.role")} error={state.fields?.role} hint={canChangeRole ? undefined : t("users.f.roleLocked")}>
          <RoleSelect value={v.role ?? admin.role} error={!!state.fields?.role} disabled={!canChangeRole} />
        </Field>
      </div>
      {/* حقل معطّل لا يُرسل: نرسل الدور الحالي حتى لا يُفهم غيابه كتغيير */}
      {canChangeRole ? null : <input type="hidden" name="role" value={admin.role} />}
      <div>
        <SubmitButton pendingText={t("common.saving")}>{t("clients.saveChanges")}</SubmitButton>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ adminId, self }: { adminId: string; self: boolean }) {
  const [state, action] = useActionState(resetAdminPasswordAction.bind(null, adminId), initialState);
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <PasswordFields fields={state.fields} />
      <div>
        <ConfirmButton variant="secondary" message={self ? t("users.confirm.resetSelf") : t("users.confirm.reset")}>
          {t("users.resetPassword")}
        </ConfirmButton>
      </div>
    </form>
  );
}

export function StatusToggle({ id, isActive, label }: { id: string; isActive: boolean; label: string }) {
  const [state, action] = useActionState(toggleAdminStatusAction.bind(null, id), initialState);
  const t = useT();
  return (
    <form action={action} className="flex flex-col items-start gap-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <ConfirmButton
        variant={isActive ? "danger" : "primary"}
        message={isActive ? t("users.confirm.disable", { name: label }) : t("users.confirm.enable", { name: label })}
      >
        {isActive ? t("users.disable") : t("users.enable")}
      </ConfirmButton>
    </form>
  );
}

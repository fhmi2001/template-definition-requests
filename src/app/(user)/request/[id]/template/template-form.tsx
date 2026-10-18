"use client";

import { useActionState, useState } from "react";
import { saveTemplateAction } from "@/actions/requests";
import { initialState } from "@/lib/action-state";
import { Alert, Field, SubmitButton, inputClass } from "@/components/ui";
import { StepFooter } from "@/components/step-footer";
import { useT } from "@/i18n/client";

const DESCRIPTION_MAX = 1000;

/** اسم القالب ووصفه (إلزاميان). */
export function TemplateForm({
  draftId,
  initialName,
  initialDescription,
  backHref,
  fromReview = false,
}: {
  draftId: string;
  initialName: string;
  initialDescription: string;
  backHref: string;
  /** فُتحت من صفحة المراجعة: الحفظ يعيد إليها */
  fromReview?: boolean;
}) {
  const [state, action] = useActionState(saveTemplateAction.bind(null, draftId), initialState);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const over = description.length > DESCRIPTION_MAX;
  const t = useT();

  return (
    <form action={action} className="flex flex-col gap-7 rounded-2xl border border-line bg-white p-5 sm:p-8" noValidate>
      {fromReview ? <input type="hidden" name="from" value="review" /> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="max-w-[560px]">
        <Field id="template-name" label={t("template.name")} error={state.fields?.templateName}>
          <input
            id="template-name"
            name="templateName"
            type="text"
            required
            maxLength={100}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!state.fields?.templateName}
            className={inputClass(!!state.fields?.templateName)}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <Field id="template-description" label={t("template.description")} error={state.fields?.templateDescription}>
          <textarea
            id="template-description"
            name="templateDescription"
            required
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={!!state.fields?.templateDescription}
            aria-describedby="template-description-count"
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-base leading-7 ${
              state.fields?.templateDescription || over ? "border-danger-600" : "border-field"
            }`}
          />
        </Field>
        <p id="template-description-count" className={`text-end text-[13px] ${over ? "font-semibold text-danger-600" : "text-muted"}`}>
          <span dir="ltr">
            {description.length} / {DESCRIPTION_MAX}
          </span>
        </p>
      </div>

      <StepFooter backHref={backHref} backLabel={fromReview ? t("review.back") : t("common.previous")}>
        <SubmitButton pendingText={t("common.saving")} className="min-w-32">
          {fromReview ? t("review.save") : t("common.next")}
        </SubmitButton>
      </StepFooter>
    </form>
  );
}

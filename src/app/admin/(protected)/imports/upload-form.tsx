"use client";

import { useT } from "@/i18n/client";
import { useActionState, useState } from "react";
import { startImportAction } from "@/actions/imports";
import { initialState } from "@/lib/action-state";
import { MAX_IMPORT_BYTES } from "@/lib/import-limits";
import { Alert, SubmitButton } from "@/components/ui";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function UploadForm() {
  const [state, action] = useActionState(startImportAction, initialState);
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const t = useT();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setLocalError(null);
    if (f && !/\.xlsx$/i.test(f.name)) setLocalError(t("ci.local.xlsxOnly"));
    else if (f && f.size > MAX_IMPORT_BYTES) setLocalError(t("upload.tooBig", { mb: 10 }));
    setFile(f);
  }

  const error = localError ?? state.error;

  return (
    <form action={action} className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}

      <label
        htmlFor="file"
        className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-field bg-canvas-2 px-6 py-10 text-center hover:border-brand-600 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-brand-300 focus-within:outline-solid"
      >
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15V3" />
            <path d="M7 8l5-5 5 5" />
            <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
          </svg>
        </span>
        {file ? (
          <span className="flex flex-col gap-1">
            <span dir="ltr" className="font-mono text-sm break-all">
              {file.name}
            </span>
            <span className="text-[13px] text-muted">{formatSize(file.size)} · {t("ci.pickAnother")}</span>
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            <span className="text-base font-semibold">{t("imports.chooseFile")}</span>
            <span className="text-[13px] text-muted">{t("imports.fileLimits", { mb: 10 })}</span>
          </span>
        )}
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onChange}
          className="sr-only"
        />
      </label>

      <div>
        <SubmitButton pendingText={t("imports.uploading")} disabled={!file || !!localError}>
          {t("imports.uploadStart")}
        </SubmitButton>
      </div>
    </form>
  );
}

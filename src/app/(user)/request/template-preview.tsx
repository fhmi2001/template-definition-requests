"use client";

import { findTokens, tokenText, variableTypeLabel, type VariableSpec } from "@/lib/template-rules";
import { useLocale, useT } from "@/i18n/client";
import { dirOf } from "@/i18n/config";
import { TokenChip } from "@/components/message-bubble";

/** نص القالب مع إظهار كل متغير كشارة فيها رقمه ونوعه وطوله. */
export function TemplatePreview({
  text,
  specs,
  signature,
  className = "",
}: {
  text: string;
  specs: VariableSpec[];
  /** سطر ثابت في نهاية الرسالة (Client Name للتوعوي) */
  signature?: string | null;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const tokens = findTokens(text);
  const parts: React.ReactNode[] = [];
  let last = 0;
  tokens.forEach((tok, i) => {
    if (tok.start > last) parts.push(text.slice(last, tok.start));
    const spec = specs[i];
    parts.push(
      <TokenChip
        key={`v${i}`}
        note={
          <span dir={dirOf(locale)} className="font-sans text-[0.9em] font-normal text-ink-2">
            {spec?.type ? variableTypeLabel(t, spec.type) : t("preview.noType")}
            {spec?.length ? ` · ${spec.length}` : ""}
          </span>
        }
      >
        {tokenText(i + 1)}
      </TokenChip>,
    );
    last = tok.end;
  });
  if (last < text.length) parts.push(text.slice(last));
  if (signature) {
    parts.push(
      <span key="sig" className="block font-semibold" title={t("preview.fixedLine")}>
        {signature}
      </span>,
    );
  }
  return <p className={`whitespace-pre-wrap break-words ${className}`}>{parts.length ? parts : <span className="text-muted">—</span>}</p>;
}

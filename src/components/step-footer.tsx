import type { ReactNode } from "react";
import { LinkButton } from "./link-button";

/** أزرار أسفل مرحلة الطلب: «السابق» في البداية، والإجراءات في النهاية. */
export function StepFooter({ backHref, backLabel, children }: { backHref: string; backLabel: string; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-hair pt-5 sm:flex-row sm:items-center sm:justify-between">
      <LinkButton href={backHref}>{backLabel}</LinkButton>
      <div className="grid auto-cols-fr grid-flow-col gap-3 sm:flex">{children}</div>
    </div>
  );
}

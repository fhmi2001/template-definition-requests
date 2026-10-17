import type { ImportStatus } from "@/generated/prisma/enums";
import { getT } from "@/i18n/server";

const STYLES: Record<ImportStatus, string> = {
  PENDING: "bg-[#e9ece8] text-[#3f4945]",
  PROCESSING: "bg-[#e9ece8] text-[#3f4945]",
  COMPLETED: "bg-brand-50 text-brand-600",
  COMPLETED_WITH_ERRORS: "bg-warn-50 text-warn-700",
  FAILED: "bg-danger-50 text-danger-700",
};

export async function ImportStatusChip({ status }: { status: ImportStatus }) {
  const { t } = await getT();
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${STYLES[status]}`}>{t(`imports.st.${status}`)}</span>
  );
}

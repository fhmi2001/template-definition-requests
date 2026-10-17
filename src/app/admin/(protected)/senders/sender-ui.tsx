import { STATUS_KEY, type SenderStatus } from "@/lib/sender-status";
import { getT } from "@/i18n/server";

const STATUS_STYLE: Record<SenderStatus, string> = {
  active: "bg-brand-50 text-brand-600",
  expiring: "bg-warn-50 text-warn-700",
  expired: "bg-chip text-ink-2",
  missing: "bg-danger-50 text-danger-700",
  disabled: "bg-chip text-ink-2",
  manual: "border border-dashed border-field-strong text-ink-2",
  unknown: "border border-dashed border-field-strong text-ink-2",
};

const STATUS_ICON: Partial<Record<SenderStatus, React.ReactNode>> = {
  active: <path d="M5 12l5 5L20 7" />,
  expiring: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  expired: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>
  ),
  missing: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  disabled: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
};

/** شارة حالة المرسل: لون + أيقونة + نص (لا تعتمد على اللون وحده). */
export async function SenderStatusChip({ status }: { status: SenderStatus }) {
  const { t } = await getT();
  const icon = STATUS_ICON[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold ${STATUS_STYLE[status]}`}>
      {icon ? (
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      ) : null}
      {t(STATUS_KEY[status])}
    </span>
  );
}

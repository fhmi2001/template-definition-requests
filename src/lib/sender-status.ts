/** حالة المرسل كما تظهر للأدمن. تُحسب ولا تُخزَّن. */
export type SenderStatus = "active" | "expiring" | "expired" | "missing" | "disabled" | "manual" | "unknown";

export const EXPIRING_DAYS = 30;

/** مفتاح ترجمة اسم الحالة. */
export const STATUS_KEY = {
  active: "status.active",
  expiring: "status.expiring",
  expired: "status.expired",
  missing: "status.missing",
  disabled: "status.disabled",
  manual: "status.manual",
  unknown: "status.unknown",
} as const satisfies Record<SenderStatus, string>;

/** تاريخ اليوم بتوقيت الرياض، كتاريخ UTC منتصف الليل (نفس صيغة تواريخ الإكسل المخزنة). */
export function todayRiyadh(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(now); // 2026-10-13
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export function senderStatus(
  s: { isActive: boolean; missingFromFile: boolean; requestId: string | null; senderExpiryDate: Date | null },
  today = todayRiyadh(),
): SenderStatus {
  if (!s.isActive) return "disabled";
  if (s.missingFromFile) return "missing";
  if (!s.requestId) return "manual";
  if (!s.senderExpiryDate) return "unknown";
  if (s.senderExpiryDate <= today) return "expired";
  if (s.senderExpiryDate <= addDays(today, EXPIRING_DAYS)) return "expiring";
  return "active";
}

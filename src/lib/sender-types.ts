import type { TX } from "@/i18n/translate";

/**
 * الفئات الأربع المعتمدة لرسائل SMS بترتيب عرضها. أسماؤها وتعريفاتها في قاموس اللغات
 * (senderType.* و senderType.purpose.* و senderType.examples.*).
 */
export const SENDER_TYPES = ["Service", "Awareness", "Warning", "Advertisement"] as const;

export const AWARENESS = "Awareness";

type HasX = { x: TX };

/** الترجمة إن كان المفتاح معروفاً، وإلا القيمة كما جاءت في الإكسل. */
const known = (t: HasX, key: string, raw: string) => {
  const r = t.x(key);
  return r === key ? raw : r;
};

/** «توعوي» بالعربية، و«Awareness» بالإنجليزية. */
export const senderTypeLabel = (t: HasX, type: string) => known(t, `senderType.${type}`, type);
/** «توعوي · Awareness» بالعربية، و«Awareness» بالإنجليزية. */
export const senderTypeDisplay = (t: HasX, type: string) => known(t, `senderTypeDisplay.${type}`, type);

export const customerTypeLabel = (t: HasX, ct: string | null) => (ct ? known(t, `customerType.${ct}`, ct) : "—");
/** «خاص · Private» بالعربية، و«Private» بالإنجليزية. */
export const customerTypeDisplay = (t: HasX, ct: string) => {
  const label = customerTypeLabel(t, ct);
  return label === ct ? ct : `${label} · ${ct}`;
};

/**
 * الأنواع التي يختار منها العميل: الأربعة دائماً ولكل العملاء.
 * أنواع المرسل المسجّلة في ملف الإكسل تبقى للعرض في لوحة الإدارة فقط ولا تقيّد العميل.
 */
export const allowedSenderTypes = (_registered?: string[]): string[] => [...SENDER_TYPES];

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

export const ADVERTISEMENT = "Advertisement";
/** اسم المرسل للإعلاني: 8 أحرف على الأكثر، تُحسب المسافات والرموز. */
export const AD_SENDER_NAME_MAX = 8;

/** اسم مرسل إعلاني مسجَّل بلاحقة ‎-AD (مثل Dfruit-AD): لا يُستخدم إلا للنوع الإعلاني. */
export const AD_SUFFIX = "-AD";
export const isAdSenderName = (name: string) => /-AD$/i.test(name.trim());

/** طول الاسم بلا لاحقة ‎-AD: حد الأحرف الثمانية يخص الاسم نفسه، واللاحقة تُضاف فوقه (8 + 3 = 11). */
export const senderNameLength = (name: string) => Array.from(isAdSenderName(name) ? name.trim().slice(0, -AD_SUFFIX.length) : name).length;

export type TypeBlock = "adNameTooLong" | "adOnly";

/**
 * سبب منع النوع لهذا المرسل، أو null إن كان متاحاً:
 * - adNameTooLong: الإعلاني لاسم أطول من 8 أحرف (بلا اللاحقة)
 * - adOnly: نوع غير إعلاني لاسم ينتهي بـ ‎-AD
 */
export const typeBlockReason = (type: string, senderName: string): TypeBlock | null => {
  if (type === ADVERTISEMENT) return senderNameLength(senderName) > AD_SENDER_NAME_MAX ? "adNameTooLong" : null;
  return isAdSenderName(senderName) ? "adOnly" : null;
};

export const isTypeBlocked = (type: string, senderName: string) => typeBlockReason(type, senderName) !== null;

/**
 * الأنواع التي يختار منها العميل: الأربعة لكل العملاء، عدا الإعلاني إن كان اسم المرسل أطول من 8 أحرف،
 * واسم المرسل المنتهي بـ ‎-AD للإعلاني وحده.
 * أنواع المرسل المسجّلة في ملف الإكسل تبقى للعرض في لوحة الإدارة فقط ولا تقيّد العميل.
 */
export const allowedSenderTypes = (senderName: string): string[] => SENDER_TYPES.filter((t) => !isTypeBlocked(t, senderName));

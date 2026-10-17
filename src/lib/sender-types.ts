import type { TX } from "@/i18n/translate";

/** أنواع المرسل كما في ملف الإكسل. أسماؤها المترجمة في قاموس اللغات (senderType.*). */
export const SENDER_TYPES = ["Advertisement", "Service", "Awareness", "Warning"] as const;

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

/** الأنواع التي يختار منها العميل: أنواع المرسل المسجّلة في الإكسل، أو الأربعة إن لم يُسجَّل له نوع. */
export const allowedSenderTypes = (registered: string[]) => (registered.length ? [...new Set(registered)] : [...SENDER_TYPES]);

/** أنواع المرسل كما في ملف الإكسل. أسماؤها المترجمة في قاموس اللغات (senderType.*). */
export const SENDER_TYPES = ["Advertisement", "Service", "Awareness", "Warning"] as const;

export const AWARENESS = "Awareness";

const ALL: string[] = [...SENDER_TYPES];

/** «توعوي · Awareness» بالعربية، و«Awareness» بالإنجليزية؛ والقيمة كما هي إن كانت غير معروفة. */
export const senderTypeDisplay = (t: { x: (k: string) => string }, value: string) => {
  const key = `senderTypeDisplay.${value}`;
  const r = t.x(key);
  return r === key ? value : r;
};

/** الأنواع التي يختار منها العميل: أنواع المرسل المسجّلة في الإكسل، أو الأربعة إن لم يُسجَّل له نوع. */
export const allowedSenderTypes = (registered: string[]) => (registered.length ? [...new Set(registered)] : [...ALL]);

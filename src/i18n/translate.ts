import type { Locale } from "./config";
import type { Params } from "./types";
import { createT, type Dict, type MessageKey, type T, type TX } from "./core";
import { ar } from "./messages/ar";
import { en } from "./messages/en";

/*
 * الترجمة في الخادم (وفي رسائل البريد): القاموسان معاً، والعربية احتياطية.
 * المكونات في المتصفح تستخدم i18n/client.tsx الذي يحمّل قاموس اللغة الحالية فقط.
 */

export { msg, type Msg, type MessageKey, type Params, type T, type TX } from "./core";

const DICTS: Record<Locale, Dict> = { ar, en };

export function makeT(locale: Locale): T & { x: TX } {
  return createT(DICTS[locale], DICTS.ar);
}

/**
 * رسالة مخزنة (في قاعدة البيانات أو JSON): مفتاح، أو «مفتاح|{params}».
 * الرسائل القديمة المخزنة كنص عربي تُعرض كما هي.
 */
export function encodeMsg(key: MessageKey, params?: Params): string {
  return params && Object.keys(params).length ? `${key}|${JSON.stringify(params)}` : key;
}

function decodeMsg(stored: string): { key: string; params?: Params } {
  const i = stored.indexOf("|");
  if (i > 0 && /^[a-zA-Z0-9_.]+$/.test(stored.slice(0, i))) {
    try {
      return { key: stored.slice(0, i), params: JSON.parse(stored.slice(i + 1)) as Params };
    } catch {
      return { key: stored };
    }
  }
  return { key: stored };
}

export const translateStored = (locale: Locale, stored: string) => {
  const { key, params } = decodeMsg(stored);
  return makeT(locale).x(key, params);
};

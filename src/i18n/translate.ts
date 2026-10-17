import type { Locale } from "./config";
import type { Entry, ParamValue, Params } from "./types";
import { ar, type MessageKey } from "./messages/ar";
import { en } from "./messages/en";

export type { MessageKey } from "./messages/ar";
export type { Params } from "./types";

/** رسالة جاهزة للترجمة لاحقاً (تُستخدم في وحدات مشتركة بين المتصفح والخادم). */
export type Msg = { k: MessageKey; p?: Params };

const DICTS: Record<Locale, Record<string, Entry>> = { ar, en };

/**
 * يترجم مفتاحاً. إن لم يكن المفتاح معروفاً يُعاد النص كما هو
 * (مثلاً رسائل قديمة محفوظة في قاعدة البيانات بالعربية).
 */
function translate(locale: Locale, key: string, params?: Params): string {
  const entry = DICTS[locale][key] ?? DICTS.ar[key];
  if (entry === undefined) return key;
  if (typeof entry === "function") return entry(params ?? {});
  if (!params) return entry;
  return entry.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? formatParam(locale, params[k]) : m));
}

function formatParam(locale: Locale, v: ParamValue): string {
  // قيمة هي مفتاح (مثل سبب خطأ من التحقق) تُترجم أيضاً
  if (typeof v === "string") return v in DICTS.ar ? translate(locale, v) : v;
  if (!Array.isArray(v)) return String(v);
  const sep = DICTS[locale]["common.listSep"] as string;
  return (v as readonly ParamValue[])
    .map((x) => (typeof x === "string" && x in DICTS.ar ? translate(locale, x) : formatParam(locale, x)))
    .join(sep);
}

export type T = (key: MessageKey, params?: Params) => string;
/** ترجمة رسالة من نوع Msg. */
export const msg = (t: T, m: Msg) => t(m.k, m.p);
/** يقبل مفتاحاً أو نصاً جاهزاً (للرسائل المخزنة أو القادمة من مصادر أخرى). */
export type TX = (keyOrText: string, params?: Params) => string;

export function makeT(locale: Locale): T & { x: TX } {
  const t = ((key: MessageKey, params?: Params) => translate(locale, key, params)) as T & { x: TX };
  t.x = (keyOrText, params) => translate(locale, keyOrText, params);
  return t;
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
  return translate(locale, key, params);
};

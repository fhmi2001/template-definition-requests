import type { Entry, ParamValue, Params } from "./types";
import type { MessageKey } from "./messages/ar";

/*
 * منطق الترجمة بلا قواميس: يُستخدم في المتصفح مع قاموس اللغة الحالية فقط (client.tsx)،
 * وفي الخادم مع القاموسين (translate.ts). لا تستورد هنا ملفات messages إلا كأنواع.
 */

export type { MessageKey } from "./messages/ar";
export type { Params } from "./types";
export type Dict = Record<string, Entry>;

/** رسالة جاهزة للترجمة لاحقاً (تُستخدم في وحدات مشتركة بين المتصفح والخادم). */
export type Msg = { k: MessageKey; p?: Params };

export type T = (key: MessageKey, params?: Params) => string;
/** يقبل مفتاحاً أو نصاً جاهزاً (للرسائل المخزنة أو القادمة من مصادر أخرى). */
export type TX = (keyOrText: string, params?: Params) => string;

/** ترجمة رسالة من نوع Msg. */
export const msg = (t: T, m: Msg) => t(m.k, m.p);

/**
 * مترجم للغة واحدة. fallback قاموس احتياطي (العربية في الخادم) لمفتاح غير موجود في القاموس.
 * إن لم يكن المفتاح معروفاً يُعاد النص كما هو (مثلاً رسائل قديمة محفوظة في قاعدة البيانات بالعربية).
 */
export function createT(dict: Dict, fallback?: Dict): T & { x: TX } {
  const known = (key: string) => key in dict || (!!fallback && key in fallback);

  function translate(key: string, params?: Params): string {
    const entry = dict[key] ?? fallback?.[key];
    if (entry === undefined) return key;
    if (typeof entry === "function") return entry(params ?? {});
    if (!params) return entry;
    return entry.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? formatParam(params[k]) : m));
  }

  function formatParam(v: ParamValue): string {
    // قيمة هي مفتاح (مثل سبب خطأ من التحقق) تُترجم أيضاً
    if (typeof v === "string") return known(v) ? translate(v) : v;
    if (!Array.isArray(v)) return String(v);
    const sep = (dict["common.listSep"] ?? fallback?.["common.listSep"]) as string;
    return (v as readonly ParamValue[]).map((x) => (typeof x === "string" && known(x) ? translate(x) : formatParam(x))).join(sep);
  }

  const t = ((key: MessageKey, params?: Params) => translate(key, params)) as T & { x: TX };
  t.x = (keyOrText, params) => translate(keyOrText, params);
  return t;
}

"use client";

import { createContext, use, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { createT, type Dict } from "./core";

/*
 * قاموس اللغة الحالية فقط يصل للمتصفح، في ملف منفصل يُحمّل عند الحاجة
 * (بدل القاموسين مع نصوص الإدارة في كل صفحة). الخادم يستخدم translate.ts بالقاموسين.
 */
const LOADERS: Record<Locale, () => Promise<Dict>> = {
  ar: () => import("./messages/ar").then((m) => m.ar),
  en: () => import("./messages/en").then((m) => m.en),
};

// وعد واحد لكل لغة طوال عمر الصفحة (شرط use())
const pending = new Map<Locale, Promise<Dict>>();
function loadDict(locale: Locale) {
  let p = pending.get(locale);
  if (!p) {
    p = LOADERS[locale]();
    pending.set(locale, p);
  }
  return p;
}

type I18n = { locale: Locale; dict: Dict | null };
const I18nContext = createContext<I18n>({ locale: DEFAULT_LOCALE, dict: null });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  // تبديل اللغة يتم داخل transition، فتبقى الصفحة الحالية ظاهرة حتى يصل قاموس اللغة الأخرى
  const dict = use(loadDict(locale));
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useLocale = () => useContext(I18nContext).locale;

export function useT() {
  const { dict } = useContext(I18nContext);
  return useMemo(() => createT(dict ?? {}), [dict]);
}

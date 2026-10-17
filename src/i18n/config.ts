/** اللغات المدعومة. الإنجليزية هي الافتراضية، والاختيار يُحفظ في كوكي. */
export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "tdr_lang";

export const isLocale = (v: unknown): v is Locale => v === "ar" || v === "en";
export const dirOf = (l: Locale) => (l === "ar" ? "rtl" : "ltr");

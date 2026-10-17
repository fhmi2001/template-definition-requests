import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { makeT } from "./translate";

/** لغة الطلب الحالي من الكوكي (العربية افتراضياً). */
export const getLocale = cache(async (): Promise<Locale> => {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}

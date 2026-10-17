import type { Locale } from "@/i18n/config";

// تقويم ميلادي وأرقام لاتينية بتوقيت الرياض في اللغتين
const TAGS: Record<Locale, string> = { ar: "ar-SA-u-ca-gregory-nu-latn", en: "en-GB" };
const dateTime = Object.fromEntries(
  (Object.keys(TAGS) as Locale[]).map((l) => [l, new Intl.DateTimeFormat(TAGS[l], { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" })]),
) as Record<Locale, Intl.DateTimeFormat>;
const dateOnly = Object.fromEntries(
  (Object.keys(TAGS) as Locale[]).map((l) => [l, new Intl.DateTimeFormat(TAGS[l], { dateStyle: "medium", timeZone: "Asia/Riyadh" })]),
) as Record<Locale, Intl.DateTimeFormat>;

export const formatDateTime = (d: Date | null | undefined, locale: Locale) => (d ? dateTime[locale].format(d) : "—");
export const formatDate = (d: Date | null | undefined, locale: Locale) => (d ? dateOnly[locale].format(d) : "—");
export const formatNumber = (n: number) => n.toLocaleString("en-US");

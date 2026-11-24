import { findTokens, linkBase, sanitizeSpecs, type VariableType } from "@/lib/template-rules";

/** تصنيف Mobily لكل نوع مرسل في المنصة. */
export const MOBILY_CLASSIFICATION: Record<string, string> = {
  Service: "Service",
  Advertisement: "Advertising",
  Warning: "Service",
  Awareness: "Awareness",
};

/** نوع المتغير في Mobily. */
export const MOBILY_VARIABLE_TYPE: Record<VariableType, string> = {
  NUMBER: "Numbers",
  TEXT: "Letters",
  ALPHANUMERIC: "Letters & Numbers",
  URL: "Link",
};

/** عينة احتياطية إن تعذر استخراج الرابط الأساسي. */
export const LINK_SAMPLE = "https://deewan.sa";

export type MobilyVariable = {
  token: string;
  platformType: string | null;
  mobilyType: string | null;
  maxLength: number | null;
  /** عينة جاهزة للحقل: الرابط ثابت، وغيره يُترك للوكيل. */
  sample: string | null;
};

/**
 * اسم/عينة متغير Link = الرابط الأساسي للرابط الذي كتبه العميل ملاصقاً للمتغير
 * (مثل https://staging.zoneder5.ai من https://staging.zoneder5.ai/a/b?id=#Var2#).
 */
export function mobilyVariables(raw: unknown, content: string | null = ""): MobilyVariable[] {
  const text = content ?? "";
  const tokens = findTokens(text);
  return sanitizeSpecs(raw).map((v, i) => ({
    token: `#Var${i + 1}#`,
    platformType: v.type,
    mobilyType: v.type ? MOBILY_VARIABLE_TYPE[v.type] : null,
    maxLength: v.length,
    sample: v.type === "URL" ? ((tokens[i] && linkBase(text.slice(0, tokens[i].start))) || LINK_SAMPLE) : null,
  }));
}

export const mobilyClassification = (senderType: string | null) => (senderType ? (MOBILY_CLASSIFICATION[senderType] ?? null) : null);

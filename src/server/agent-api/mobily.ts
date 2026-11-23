import { sanitizeSpecs, type VariableType } from "@/lib/template-rules";

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

/** عينة الرابط الثابتة في Mobily (لا يُكتب https:// قبل المتغير في النص). */
export const LINK_SAMPLE = "https://deewan.sa";

export type MobilyVariable = {
  token: string;
  platformType: string | null;
  mobilyType: string | null;
  maxLength: number | null;
  /** عينة جاهزة للحقل: الرابط ثابت، وغيره يُترك للوكيل. */
  sample: string | null;
};

export function mobilyVariables(raw: unknown): MobilyVariable[] {
  return sanitizeSpecs(raw).map((v, i) => ({
    token: `#Var${i + 1}#`,
    platformType: v.type,
    mobilyType: v.type ? MOBILY_VARIABLE_TYPE[v.type] : null,
    maxLength: v.length,
    sample: v.type === "URL" ? LINK_SAMPLE : null,
  }));
}

export const mobilyClassification = (senderType: string | null) => (senderType ? (MOBILY_CLASSIFICATION[senderType] ?? null) : null);

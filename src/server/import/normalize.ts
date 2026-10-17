import "server-only";

/** رموز اتجاه النص والمسافات الخفية التي تظهر في بعض خلايا الملف. */
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

export type CellValue = string | number | boolean | Date | null;

/** يحوّل أي قيمة خلية من ExcelJS إلى قيمة بسيطة. */
export function plainCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) return v.richText.map((p) => (p as { text?: string }).text ?? "").join("");
    if ("result" in v) return plainCell(v.result); // خلية معادلة
    if (typeof v.text === "string") return v.text; // رابط
    if ("error" in v) return null;
  }
  return String(value);
}

/** نص منظّف: بدون رموز خفية، والمسافات المتعددة مسافة واحدة. يعيد null للفارغ. */
export function cleanText(value: CellValue): { text: string | null; hadInvisible: boolean } {
  if (value === null) return { text: null, hadInvisible: false };
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  const stripped = raw.replace(INVISIBLE, "");
  const text = stripped.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  return { text: text === "" ? null : text, hadInvisible: stripped !== raw };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** تاريخ UTC منتصف الليل، أو null. */
function utcDate(y: number, m: number, d: number) {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 ? date : null; // يرفض 31/02 مثلاً
}

export type ParsedDate = { ok: true; date: Date | null } | { ok: false };

/**
 * يقبل: تاريخ Excel حقيقي، رقم تسلسلي، "2026-10-13"، "2026/10/13"، "13/10/2026".
 * التاريخ 0001-01-01 (وأي سنة قبل 1900) يُعامل كفارغ.
 */
export function parseDate(value: CellValue): ParsedDate {
  if (value === null || value === "") return { ok: true, date: null };
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { ok: false };
    if (value.getUTCFullYear() < 1900) return { ok: true, date: null };
    return { ok: true, date: utcDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()) };
  }
  if (typeof value === "number") {
    if (value <= 0) return { ok: true, date: null };
    const ms = Math.round((value - 25569) * 86400 * 1000); // رقم Excel التسلسلي
    const d = new Date(ms);
    return { ok: true, date: utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) };
  }
  const s = cleanText(value).text;
  if (!s) return { ok: true, date: null };
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
  if (m) {
    const y = Number(m[1]);
    if (y < 1900) return { ok: true, date: null };
    const d = utcDate(y, Number(m[2]), Number(m[3]));
    return d ? { ok: true, date: d } : { ok: false };
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const d = utcDate(Number(m[3]), Number(m[2]), Number(m[1]));
    return d ? { ok: true, date: d } : { ok: false };
  }
  return { ok: false };
}

export const isoDate = (d: Date | null) =>
  d ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` : null;

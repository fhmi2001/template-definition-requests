/**
 * شروط قبول نص قالب رسائل الجوال.
 * وحدة واحدة تعمل في المتصفح (تحقق لحظي) وفي الخادم (تحقق نهائي قبل الحفظ والتقديم)،
 * فلا يمكن تجاوزها بالتلاعب بالصفحة.
 *
 * المتغير يُكتب في النص بالصيغة #Var1#، #Var2#... ويُرقَّم حسب ترتيب ظهوره.
 * الصيغة القديمة {{1}} تُقبل أيضاً وتُحوَّل تلقائياً إلى #Var1#.
 */
import { isShortenerHost, URL_SHORTENERS } from "./url-shorteners";
import type { Msg, T } from "@/i18n/translate";

export const TEMPLATE_MAX_LENGTH = 1000;
export const MAX_VARIABLES = 2;
export const MIN_STATIC_RATIO = 0.6;
export const MAX_VARIABLE_LENGTH = 30;
/** حد منطقي لطول المتغير حتى في استثناء الجهات الحكومية. */
export const VARIABLE_LENGTH_CEILING = 500;

export const VARIABLE_TYPES = [
  { value: "NUMBER", key: "varType.NUMBER" },
  { value: "TEXT", key: "varType.TEXT" },
  { value: "ALPHANUMERIC", key: "varType.ALPHANUMERIC" },
  { value: "URL", key: "varType.URL" },
] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number]["value"];
export type VariableSpec = { type: VariableType | null; length: number | null };

export const variableTypeLabel = (t: T, type: string | null) => {
  const k = VARIABLE_TYPES.find((v) => v.value === type)?.key;
  return k ? t(k) : "—";
};
const isVariableType = (t: unknown): t is VariableType => VARIABLE_TYPES.some((v) => v.value === t);

/** استثناءات الجهات الحكومية (الشروط 1 و4 و5) — كل منها يتطلب خطاب تعهد. */
export const EXCEPTIONS = {
  MAX_VARIABLES: "exception.MAX_VARIABLES",
  STATIC_RATIO: "exception.STATIC_RATIO",
  VARIABLE_LENGTH: "exception.VARIABLE_LENGTH",
} as const;
export type ExceptionId = keyof typeof EXCEPTIONS;
/** اسم الاستثناء بلغة المستخدم (القيم غير المعروفة تُعرض كما هي). */
export const exceptionLabel = (t: T, id: string) => (id in EXCEPTIONS ? t(EXCEPTIONS[id as ExceptionId]) : id);

export const isGovernment = (customerType: string | null | undefined) => customerType?.trim().toLowerCase() === "government";

// -----------------------------------------------------------------------------
// المتغيرات في النص
// -----------------------------------------------------------------------------

/** #Var1# (بأي حالة أحرف ومسافات داخلها)، أو الصيغة القديمة {{1}}. */
const TOKEN_RE = /#\s*var\s*(\d{1,3})\s*#|\{\{\s*(\d{1,3})\s*\}\}/gi;
/** متغير مكتوب بشكل ناقص، مثل #Var1 أو Var1# */
const BROKEN_TOKEN_RE = /#\s*var\s*\d|var\s*\d{1,3}\s*#/i;
export type Token = { number: number; start: number; end: number };

export const tokenText = (n: number) => `#Var${n}#`;

/**
 * سطر ثابت في نهاية الرسالة: Client Name عند نوع المرسل «توعوي».
 * لا يُكتب في مربع النص، بل يُضاف تلقائياً ولا يمكن حذفه. الأقواس تُزال حتى لا يُقرأ كمتغير.
 */
export function messageSignature(senderType: string | null | undefined, awarenessClientName: string | null | undefined) {
  if (senderType !== "Awareness" || !awarenessClientName) return null;
  const s = awarenessClientName
    .replace(/[{}]/g, "")
    .replace(/#(?=\s*var\s*\d)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

/** نص الرسالة كاملاً: ما كتبه العميل، ثم السطر الثابت (إن وجد) في سطر جديد. */
export const composeMessage = (body: string, signature: string | null | undefined) =>
  signature ? `${body.replace(/\s+$/, "")}\n${signature}` : body;

/** توحيد نهايات الأسطر وإزالة رموز الاتجاه والمسافات الخفية (لا تظهر لكنها تُحسب في الطول). */
export const cleanTemplateText = (s: string) => s.replace(/\r\n?/g, "\n").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "");
export const charCount = (s: string) => Array.from(s).length;

const LRM = "\u200E";

/**
 * للعرض فقط: علامة اتجاه غير مرئية (LRM) قبل كل متغير حتى يظهر #Var1# كما هو داخل النص العربي
 * (بدونها تظهر العلامة # في الجهة الأخرى). لا تُحفظ: cleanTemplateText يزيلها.
 */
export const markTokens = (text: string) => text.replace(TOKEN_RE, (m) => LRM + m);

/** موضع في النص الأصلي ← موضعه في النص المعروض بعد markTokens. */
export const markedIndex = (text: string, pos: number) => pos + findTokens(text).filter((t) => t.start < pos).length;

/** النص مقسّماً إلى أجزاء عادية ومتغيرات (لعزل المتغير عند العرض). */
export function splitTokens(text: string): { text: string; token: boolean }[] {
  const out: { text: string; token: boolean }[] = [];
  let last = 0;
  for (const t of findTokens(text)) {
    if (t.start > last) out.push({ text: text.slice(last, t.start), token: false });
    out.push({ text: text.slice(t.start, t.end), token: true });
    last = t.end;
  }
  if (last < text.length) out.push({ text: text.slice(last), token: false });
  return out;
}

export function findTokens(text: string): Token[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => ({ number: Number(m[1] ?? m[2]), start: m.index!, end: m.index! + m[0].length }));
}

/**
 * يعيد ترقيم المتغيرات حسب ترتيب ظهورها (#Var1# ثم #Var2#...)، ويرتب مواصفاتها بنفس الترتيب.
 * المتغير يحتفظ بنوعه وطوله إذا تغيّر رقمه (حذف متغير قبله، أو إضافة متغير في المنتصف).
 */
export function normalizeTemplate(text: string, specs: VariableSpec[]): { text: string; specs: VariableSpec[] } {
  const tokens = findTokens(text);
  const sequential = tokens.every((t, i) => t.number === i + 1 && text.slice(t.start, t.end) === tokenText(i + 1));
  if (sequential) {
    const next = tokens.map((_, i) => specs[i] ?? { type: null, length: null });
    return { text, specs: next };
  }
  const used = new Set<number>();
  let out = "";
  let last = 0;
  const next: VariableSpec[] = [];
  tokens.forEach((t, i) => {
    out += text.slice(last, t.start) + tokenText(i + 1);
    last = t.end;
    const old = !used.has(t.number) ? specs[t.number - 1] : undefined;
    used.add(t.number);
    next.push(old ?? { type: null, length: null });
  });
  out += text.slice(last);
  return { text: out, specs: next };
}

/** يقبل مواصفات المتغيرات من مصدر غير موثوق (نموذج أو JSON). */
export function sanitizeSpecs(raw: unknown): VariableSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).map((v) => {
    const o = (v ?? {}) as Record<string, unknown>;
    const n = typeof o.length === "number" ? o.length : typeof o.length === "string" && o.length.trim() !== "" ? Number(o.length) : NaN;
    return { type: isVariableType(o.type) ? o.type : null, length: Number.isFinite(n) ? n : null };
  });
}

// -----------------------------------------------------------------------------
// الروابط
// -----------------------------------------------------------------------------

const COMMON_TLDS = new Set(
  (
    "com net org info biz sa ae kw qa bh om eg jo lb iq ma tn dz ly sy ps ye sd io co me app dev ai " +
    "online site store shop tech link live xyz click top club cloud us uk de fr it es nl ru in cn tv cc " +
    "gov edu mil int mobi pro name gg gl gd to ws la nu tk ml ga cf gq vip news blog page website space " +
    "world today email network digital media services solutions agency company group center " +
    "ca au nz jp kr sg my hk tw br mx za ng ke ch se dk fi pl pt gr ie eu tr pk asia travel bank health academy design studio art fm"
  ).split(" "),
);

/**
 * رابط يبدأ بـ http(s):// أو www.، أو اسم نطاق بلا بروتوكول (deewan.sa).
 * الحدود تُفحص بالأحرف اللاتينية فقط: النطاق الملتصق بكلمة عربية (زوروناdeewan.sa) يُكتشف أيضاً،
 * والبريد الإلكتروني (info@deewan.sa) لا يُعد رابطاً.
 */
const URL_RE =
  /(?:https?:\/\/|www\.)[^\s<>"'،؛]+|(?<![a-z0-9@._%+-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(?::\d+)?(?:[/?#][^\s<>"'،؛]*)?(?![a-z0-9@])/gi;

const VAR_OPEN = "\uE000";
const VAR_CLOSE = "\uE001";
const VAR_MARK_RE = /\uE000(\d+)\uE001/g;

export type LinkFinding = { url: string; problem: "insecure" | "no-scheme" | "shortener" | "variable-host" | null; host: string };

/** يستخرج الروابط من النص (بما فيها الروابط بلا https:// مثل example.com) ويحكم على كل منها. */
export function findLinks(text: string): LinkFinding[] {
  const out: LinkFinding[] = [];
  // المتغير داخل الرابط يُستبدل مؤقتاً بعلامة لا تحتوي # (حتى لا يُقرأ كجزء # من الرابط)
  const marked = text.replace(TOKEN_RE, (_m, a?: string, b?: string) => `${VAR_OPEN}${a ?? b}${VAR_CLOSE}`);
  for (const m of marked.matchAll(URL_RE)) {
    let url = m[0];
    while (/[.,!?؟:;)\]»"']$/.test(url)) url = url.slice(0, -1);
    let lower = url.toLowerCase();
    const hasScheme = /^https?:\/\//.test(lower);
    let rest = lower.replace(/^https?:\/\//, "");
    // اسم النطاق ينتهي عند أول حرف غير لاتيني (رابط ملتصق بكلمة عربية بعده: https://bit.lyللمزيد)
    const rawHost = rest.split(/[/?#:]/)[0];
    const cutHost = rawHost.match(/^[a-z0-9.\uE000\uE001-]+/)?.[0];
    if (cutHost && cutHost.length < rawHost.length) {
      url = url.slice(0, url.length - rest.length + cutHost.length).replace(/\.+$/, "");
      lower = url.toLowerCase();
      rest = lower.replace(/^https?:\/\//, "");
    }
    const host = rest.split(/[/?#:]/)[0].replace(/^www\./, "");
    if (!hasScheme && !lower.startsWith("www.")) {
      // كلمة فيها نقطة: نعدّها رابطاً فقط إن كان امتدادها معروفاً أو كانت خدمة اختصار
      const tld = host.split(".").pop() ?? "";
      if (!COMMON_TLDS.has(tld) && !URL_SHORTENERS.has(host) && !isShortenerHost(host)) continue;
    }
    let problem: LinkFinding["problem"] = null;
    url = url.replace(VAR_MARK_RE, (_m, n: string) => tokenText(Number(n)));
    if (host.includes(VAR_OPEN)) problem = "variable-host";
    else if (isShortenerHost(host)) problem = "shortener";
    else if (lower.startsWith("http://")) problem = "insecure";
    else if (!lower.startsWith("https://")) problem = "no-scheme";
    out.push({ url, problem, host });
  }
  return out;
}

// -----------------------------------------------------------------------------
// التقييم
// -----------------------------------------------------------------------------

export type RuleStatus = "pass" | "fail" | "pending" | "note" | "exception";
export type RuleId = "text" | "maxVars" | "types" | "lengths" | "ratio" | "maxLength" | "edges" | "adjacent" | "links" | "pledge";
export type RuleResult = { id: RuleId; number: number | null; title: Msg; status: RuleStatus; details: Msg[] };

export type TemplateStats = {
  variableCount: number;
  staticLength: number;
  variablesLength: number | null; // null إذا لم تُحدد كل الأطوال
  staticRatio: number | null;
};

export type Evaluation = {
  rules: RuleResult[];
  stats: TemplateStats;
  exceptions: ExceptionId[];
  government: boolean;
  /** كل الشروط محققة (ولا يوجد ما ينتظر الإكمال)، وخطاب التعهد مرفوع إن لزم. */
  ok: boolean;
};

const pct = (r: number) => `${Math.round(r * 100)}%`;
const m = (k: Msg["k"], p?: Msg["p"]): Msg => (p ? { k, p } : { k });

export function evaluateTemplate(input: {
  /** ما كتبه العميل في مربع النص */
  text: string;
  /** سطر ثابت يُضاف في النهاية (Client Name للتوعوي). الشروط تُطبَّق على الرسالة كاملة */
  signature?: string | null;
  variables: VariableSpec[];
  customerType: string | null;
  hasPledge: boolean;
}): Evaluation {
  const text = composeMessage(input.text, input.signature);
  const trimmed = text.trim();
  const bodyEmpty = !input.text.trim();
  const government = isGovernment(input.customerType);
  const tokens = findTokens(text);
  const specs = tokens.map((_, i) => input.variables[i] ?? { type: null, length: null });
  const names = tokens.map((_, i) => tokenText(i + 1));
  const exceptions: ExceptionId[] = [];
  const rules: RuleResult[] = [];

  // نص القالب
  {
    const details: Msg[] = [];
    let status: RuleStatus = "pass";
    const length = charCount(trimmed);
    if (bodyEmpty) {
      status = "pending";
      details.push(m("rules.text.empty"));
    } else if (length > TEMPLATE_MAX_LENGTH) {
      status = "fail";
      details.push(m("rules.text.tooLong", { length, max: TEMPLATE_MAX_LENGTH }));
    }
    const stray = text.replace(TOKEN_RE, " ");
    if (BROKEN_TOKEN_RE.test(stray)) {
      if (status === "pass") status = "note";
      details.push(m("rules.text.stray"));
    }
    rules.push({ id: "text", number: null, title: m("rules.text.title"), status, details });
  }

  // 1) عدد المتغيرات
  {
    const n = tokens.length;
    let status: RuleStatus = "pass";
    const details = [n === 0 ? m("rules.noVars") : m("rules.maxVars.count", { n })];
    if (n > MAX_VARIABLES) {
      if (government) {
        status = "exception";
        exceptions.push("MAX_VARIABLES");
        details.push(m("rules.govAllowed"));
      } else {
        status = "fail";
        details.push(m("rules.maxVars.over", { max: MAX_VARIABLES, n: n - MAX_VARIABLES }));
      }
    }
    rules.push({ id: "maxVars", number: 1, title: m("rules.maxVars.title"), status, details });
  }

  // 2) نوع كل متغير
  {
    const missing = names.filter((_, i) => !specs[i].type);
    rules.push({
      id: "types",
      number: 2,
      title: m("rules.types.title"),
      status: tokens.length === 0 ? "pass" : missing.length ? "fail" : "pass",
      details: tokens.length === 0 ? [m("rules.noVars")] : missing.length ? [m("rules.types.missing", { names: missing })] : [],
    });
  }

  // 3) طول كل متغير
  const validLength = (l: number | null): l is number => l !== null && Number.isInteger(l) && l >= 1 && l <= VARIABLE_LENGTH_CEILING;
  const lengthsKnown = specs.every((s) => validLength(s.length));
  {
    const missing = names.filter((_, i) => specs[i].length === null);
    const invalid = names.filter((_, i) => specs[i].length !== null && !validLength(specs[i].length));
    const details: Msg[] = [];
    if (tokens.length === 0) details.push(m("rules.noVars"));
    if (missing.length) details.push(m("rules.lengths.missing", { names: missing }));
    if (invalid.length) details.push(m("rules.lengths.invalid", { max: VARIABLE_LENGTH_CEILING, names: invalid }));
    rules.push({
      id: "lengths",
      number: 3,
      title: m("rules.lengths.title"),
      status: missing.length || invalid.length ? "fail" : "pass",
      details,
    });
  }

  // الحسابات: النص الثابت = النص بدون المتغيرات
  const staticLength = charCount(trimmed.replace(TOKEN_RE, ""));
  const variablesLength = lengthsKnown ? specs.reduce((sum, s) => sum + (s.length ?? 0), 0) : null;
  const total = variablesLength === null ? null : staticLength + variablesLength;
  const staticRatio = total ? staticLength / total : variablesLength === 0 && staticLength > 0 ? 1 : null;

  // 4) نسبة النص الثابت
  {
    let status: RuleStatus = "pass";
    const details: Msg[] = [];
    if (bodyEmpty) {
      status = "pending";
    } else if (tokens.length === 0) {
      details.push(m("rules.ratio.allStatic"));
    } else if (staticRatio === null) {
      status = "pending";
      details.push(m("rules.ratio.needLengths"));
    } else {
      details.push(
        m("rules.ratio.stats", { staticPct: pct(staticRatio), staticLength, varPct: pct(1 - staticRatio), varLength: variablesLength ?? 0 }),
      );
      if (staticRatio < MIN_STATIC_RATIO) {
        if (government) {
          status = "exception";
          exceptions.push("STATIC_RATIO");
          details.push(m("rules.govAllowed"));
        } else {
          status = "fail";
          details.push(m("rules.ratio.fix"));
        }
      }
    }
    rules.push({ id: "ratio", number: 4, title: m("rules.ratio.title"), status, details });
  }

  // 5) طول المتغير الواحد
  {
    const tooLong = names.filter((_, i) => validLength(specs[i].length) && (specs[i].length as number) > MAX_VARIABLE_LENGTH);
    let status: RuleStatus = tokens.length === 0 ? "pass" : lengthsKnown ? "pass" : "pending";
    const details: Msg[] = tokens.length === 0 ? [m("rules.noVars")] : [];
    if (tooLong.length) {
      details.push(m("rules.maxLength.tooLong", { max: MAX_VARIABLE_LENGTH, names: tooLong }));
      if (government) {
        status = "exception";
        exceptions.push("VARIABLE_LENGTH");
        details.push(m("rules.govAllowed"));
      } else {
        status = "fail";
      }
    } else if (status === "pending") {
      details.push(m("rules.maxLength.needLengths"));
    }
    rules.push({ id: "maxLength", number: 5, title: m("rules.maxLength.title", { max: MAX_VARIABLE_LENGTH }), status, details });
  }

  // 6) البداية والنهاية
  {
    const details: Msg[] = [];
    let status: RuleStatus = bodyEmpty ? "pending" : "pass";
    if (!bodyEmpty && tokens.length) {
      const lead = text.length - text.trimStart().length;
      const tail = text.trimEnd().length;
      if (tokens[0].start === lead) {
        status = "fail";
        details.push(m("rules.edges.start", { name: names[0] }));
      }
      const lastToken = tokens[tokens.length - 1];
      if (lastToken.end === tail) {
        status = "fail";
        details.push(m("rules.edges.end", { name: names[names.length - 1] }));
      }
    }
    rules.push({ id: "edges", number: 6, title: m("rules.edges.title"), status, details });
  }

  // 7) المتغيرات المتجاورة: يلزم حرف أو رقم بينها
  {
    const pairs: string[][] = [];
    for (let i = 0; i + 1 < tokens.length; i++) {
      const between = text.slice(tokens[i].end, tokens[i + 1].start);
      if (!/[\p{L}\p{N}]/u.test(between)) pairs.push([names[i], names[i + 1]]);
    }
    rules.push({
      id: "adjacent",
      number: 7,
      title: m("rules.adjacent.title"),
      status: pairs.length ? "fail" : "pass",
      details: pairs.length ? [m("rules.adjacent.pairs", { pairs })] : [],
    });
  }

  // 8) الروابط
  {
    const links = findLinks(text);
    const details: Msg[] = [];
    let status: RuleStatus = "pass";
    for (const l of links) {
      if (l.problem === "shortener") details.push(m("rules.links.shortener", { url: l.url, host: l.host }));
      else if (l.problem === "insecure") details.push(m("rules.links.insecure", { url: l.url, fixed: l.url.replace(/^http:\/\//i, "https://") }));
      else if (l.problem === "no-scheme") details.push(m("rules.links.noScheme", { url: l.url, fixed: `https://${l.url}` }));
    }
    if (details.length) status = "fail";
    const notes: Msg[] = [];
    for (const l of links) {
      if (l.problem === "variable-host") notes.push(m("rules.links.variableHost", { url: l.url }));
    }
    names.forEach((n, i) => {
      if (specs[i].type === "URL") notes.push(m("rules.links.urlVar", { name: n }));
    });
    if (notes.length && status === "pass") status = "note";
    if (!links.length && !notes.length) details.push(m("rules.links.none"));
    rules.push({ id: "links", number: 8, title: m("rules.links.title"), status, details: [...details, ...notes] });
  }

  // 10) خطاب التعهد عند استخدام استثناءات الجهات الحكومية
  if (exceptions.length) {
    rules.push({
      id: "pledge",
      number: 10,
      title: m("rules.pledge.title"),
      status: input.hasPledge ? "pass" : "fail",
      details: [
        m("rules.pledge.used", { list: exceptions.map((e) => EXCEPTIONS[e]) }),
        input.hasPledge ? m("rules.pledge.uploaded") : m("rules.pledge.missing"),
      ],
    });
  }

  const ok = rules.every((r) => r.status === "pass" || r.status === "note" || r.status === "exception");
  return {
    rules,
    stats: { variableCount: tokens.length, staticLength, variablesLength, staticRatio },
    exceptions,
    government,
    ok,
  };
}

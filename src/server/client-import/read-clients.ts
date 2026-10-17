import "server-only";
import ExcelJS from "exceljs";
import { cleanText, plainCell } from "@/server/import/normalize";
import { cleanSenderName, clientNameSchema, emailSchema } from "@/lib/validation";
import { encodeMsg, type MessageKey, type Params } from "@/i18n/translate";

/** خطأ يمنع قراءة الملف كله (مفتاح رسالة يُترجم عند العرض). */
export class ClientFileError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params?: Params,
  ) {
    super(key);
  }
}

export type IssueSeverity = "ERROR" | "WARNING";
export type FileIssue = {
  row: number; // رقم الصف في الإكسل
  column: string | null;
  severity: IssueSeverity; // ERROR = القيمة لم تُستورد، WARNING = استُوردت مع ملاحظة
  /** مفتاح الرسالة مع متغيراتها (encodeMsg)، أو نص عربي في المعاينات القديمة */
  message: string;
  value: string | null;
};
export type Item = { value: string; row: number };
export type ParsedClient = {
  key: string; // الاسم بأحرف صغيرة: لتجميع الصفوف ومطابقة العملاء الموجودين
  name: string;
  rows: number[];
  emails: Item[];
  senders: Item[]; // أسماء المرسلين كما كُتبت في الملف
};
export type ParsedFile = {
  sheetName: string;
  totalRows: number;
  clients: ParsedClient[];
  issues: FileIssue[];
};

const MAX_ROWS = 10_000;
const MAX_CLIENTS = 2_000;
const MAX_EMAILS_PER_CLIENT = 200;
const MAX_SENDERS_PER_CLIENT = 300;
const MAX_ISSUES = 3_000;
const HEADER_SCAN_ROWS = 10;

export const COLUMN_LABEL = {
  name: "Client Name",
  email: "Email",
  sender: "Sender Name",
} as const;
type ColumnKey = keyof typeof COLUMN_LABEL;

/** عناوين مقبولة لكل عمود (بالإنجليزي أو بالعربي). */
export const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  name: ["Client Name", "Client", "Customer Name", "Customer", "Company Name", "Company", "اسم العميل", "العميل", "اسم الشركة", "اسم الجهة", "اسم المنشأة"],
  email: ["Email", "Emails", "E-mail", "Email Address", "Email Addresses", "البريد الإلكتروني", "البريد", "الإيميل", "الإيميلات", "ايميل"],
  sender: ["Sender Name", "Sender Names", "Sender", "Senders", "اسم المرسل", "أسماء المرسلين", "المرسل", "المرسلين"],
};

const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

/** توحيد العنوان: حالة الأحرف، المسافات والرموز، والهمزات والتاء المربوطة. */
const normHeader = (h: string) =>
  h
    .replace(INVISIBLE, "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\s_\-.:/()#]+/g, "");

const ALIAS_INDEX = new Map<string, ColumnKey>(
  (Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]).flatMap(([key, list]) => list.map((a) => [normHeader(a), key] as const)),
);

/** مفتاح الاسم للتجميع والمطابقة: بدون رموز خفية، مسافة واحدة، أحرف صغيرة. */
export const clientKey = (name: string) => (cleanText(name).text ?? "").toLowerCase();

/** نص الخلية كما هو (مع الأسطر الجديدة) لتفكيك القيم المتعددة. */
function rawText(value: unknown): string | null {
  const v = plainCell(value);
  if (v === null) return null;
  if (v instanceof Date) return null;
  const s = String(v).replace(INVISIBLE, "").trim();
  return s === "" ? null : s;
}

/** إيميلات الخلية: تفصلها فاصلة أو سطر جديد أو مسافة. يقبل أيضاً «الاسم <email>» و mailto: */
function splitEmailCell(raw: string): string[] {
  // «Ahmed Ali <ahmed@x.com>» ← ahmed@x.com (الاسم قبل القوسين يُحذف حتى أقرب فاصل)
  const source = raw.replace(/[^,;،\n<>]*<([^<>\s]+@[^<>\s]+)>/g, " $1 ");
  return source
    .split(/[\s,;،|]+/)
    .map((t) => t.replace(/^mailto:/i, "").replace(/^[<("'[]+|[>)"'\].]+$/g, "").trim())
    .filter(Boolean);
}

/** أسماء المرسلين في الخلية: تفصلها فاصلة أو سطر جديد (المسافة جزء من الاسم مثل «Gulf Motors»). */
function splitSenderCell(raw: string): string[] {
  return raw.split(/[\r\n,;،|]+/).map(cleanSenderName).filter(Boolean);
}

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer, {
      ignoreNodes: [
        "tableParts",
        "dataValidations",
        "conditionalFormatting",
        "drawing",
        "picture",
        "legacyDrawing",
        "extLst",
        "hyperlinks",
      ],
    });
  } catch {
    throw new ClientFileError("ci.file.unreadable");
  }
  return workbook;
}

/** أول ورقة فيها صف عناوين يحتوي على اسم العميل والبريد الإلكتروني. */
function findTable(workbook: ExcelJS.Workbook) {
  for (const sheet of workbook.worksheets) {
    if (sheet.actualRowCount === 0) continue;
    for (let r = 1; r <= Math.min(HEADER_SCAN_ROWS, sheet.rowCount); r++) {
      const columns = new Map<ColumnKey, number>();
      sheet.getRow(r).eachCell((cell, col) => {
        const text = cleanText(plainCell(cell.value)).text;
        const key = text ? ALIAS_INDEX.get(normHeader(text)) : undefined;
        if (key && !columns.has(key)) columns.set(key, col);
      });
      if (columns.has("name") && columns.has("email")) return { sheet, headerRow: r, columns };
    }
  }
  throw new ClientFileError("ci.file.noHeader");
}

export async function readClientsFile(buffer: Buffer): Promise<ParsedFile> {
  const workbook = await loadWorkbook(buffer);
  const { sheet, headerRow, columns } = findTable(workbook);
  if (sheet.rowCount - headerRow > MAX_ROWS) {
    throw new ClientFileError("ci.file.tooManyRows", { max: MAX_ROWS.toLocaleString("en-US") });
  }

  const issues: FileIssue[] = [];
  let overflow = 0;
  const addIssue = (i: FileIssue) => (issues.length < MAX_ISSUES ? issues.push(i) : overflow++);

  const groups = new Map<string, ParsedClient>();
  const emailOwner = new Map<string, { key: string; row: number }>(); // بريد ← أول عميل ورد له في الملف
  const senderOwner = new Map<string, { key: string; row: number }>(); // مفتاح المرسل ← أول عميل ورد له
  let totalRows = 0;

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cell = (key: ColumnKey) => {
      const col = columns.get(key);
      return col ? row.getCell(col).value : null;
    };
    const nameText = cleanText(plainCell(cell("name"))).text;
    const emailsRaw = rawText(cell("email"));
    const sendersRaw = rawText(cell("sender"));
    if (!nameText && !emailsRaw && !sendersRaw) continue;
    totalRows++;

    if (!nameText) {
      addIssue({ row: r, column: COLUMN_LABEL.name, severity: "ERROR", message: encodeMsg("ci.issue.nameEmpty"), value: null });
      continue;
    }
    const nameCheck = clientNameSchema.safeParse(nameText);
    if (!nameCheck.success) {
      addIssue({ row: r, column: COLUMN_LABEL.name, severity: "ERROR", message: encodeMsg("ci.issue.nameInvalid", { reason: nameCheck.error.issues[0].message }), value: nameText.slice(0, 300) });
      continue;
    }
    const name = nameCheck.data;
    const key = clientKey(name);

    let group = groups.get(key);
    if (!group) {
      if (groups.size >= MAX_CLIENTS) {
        throw new ClientFileError("ci.file.tooManyClients", { max: MAX_CLIENTS.toLocaleString("en-US") });
      }
      group = { key, name, rows: [], emails: [], senders: [] };
      groups.set(key, group);
    }
    group.rows.push(r);

    // البريد
    for (const token of emailsRaw ? splitEmailCell(emailsRaw) : []) {
      const parsed = emailSchema.safeParse(token);
      if (!parsed.success) {
        addIssue({ row: r, column: COLUMN_LABEL.email, severity: "ERROR", message: encodeMsg("ci.issue.badEmail"), value: token.slice(0, 300) });
        continue;
      }
      const email = parsed.data;
      const owner = emailOwner.get(email);
      if (owner && owner.key !== key) {
        addIssue({
          row: r,
          column: COLUMN_LABEL.email,
          severity: "ERROR",
          message: encodeMsg("ci.issue.emailDupOther", { row: owner.row }),
          value: email,
        });
        continue;
      }
      if (owner) continue; // نفس العميل: مكرر بلا أثر
      if (group.emails.length >= MAX_EMAILS_PER_CLIENT) {
        addIssue({ row: r, column: COLUMN_LABEL.email, severity: "ERROR", message: encodeMsg("ci.issue.emailLimit", { max: MAX_EMAILS_PER_CLIENT }), value: email });
        continue;
      }
      emailOwner.set(email, { key, row: r });
      group.emails.push({ value: email, row: r });
    }

    // أسماء المرسلين
    for (const senderName of sendersRaw ? splitSenderCell(sendersRaw) : []) {
      if (senderName.length > 11) {
        addIssue({ row: r, column: COLUMN_LABEL.sender, severity: "ERROR", message: encodeMsg("ci.issue.senderLong"), value: senderName.slice(0, 300) });
        continue;
      }
      const sKey = senderName.toLowerCase();
      const owner = senderOwner.get(sKey);
      if (owner && owner.key !== key) {
        addIssue({
          row: r,
          column: COLUMN_LABEL.sender,
          severity: "ERROR",
          message: encodeMsg("ci.issue.senderDupOther", { row: owner.row }),
          value: senderName,
        });
        continue;
      }
      if (owner) continue;
      if (group.senders.length >= MAX_SENDERS_PER_CLIENT) {
        addIssue({ row: r, column: COLUMN_LABEL.sender, severity: "ERROR", message: encodeMsg("ci.issue.senderLimit", { max: MAX_SENDERS_PER_CLIENT }), value: senderName });
        continue;
      }
      senderOwner.set(sKey, { key, row: r });
      group.senders.push({ value: senderName, row: r });
    }
  }

  if (totalRows === 0) throw new ClientFileError("ci.file.noData");
  if (overflow) {
    issues.push({ row: 0, column: null, severity: "WARNING", message: encodeMsg("ci.issue.overflow", { n: overflow, max: MAX_ISSUES }), value: null });
  }

  return { sheetName: sheet.name.slice(0, 100), totalRows, clients: [...groups.values()], issues };
}

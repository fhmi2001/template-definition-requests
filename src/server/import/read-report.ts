import "server-only";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import {
  COLUMNS,
  IMPORTED_STATUS,
  KNOWN_CUSTOMER_TYPES,
  KNOWN_SENDER_TYPES,
  REQUIRED_COLUMNS,
  normalizeHeader,
  type ColumnKey,
} from "./columns";
import { cleanText, isoDate, parseDate, plainCell, type CellValue } from "./normalize";
import { encodeMsg, type MessageKey, type Params } from "@/i18n/translate";

/** خطأ يمنع قراءة الملف كله (صيغة خاطئة، أعمدة أساسية ناقصة...). الرسالة مفتاح مُرمّز (encodeMsg). */
export class ImportFileError extends Error {
  constructor(key: MessageKey, params?: Params) {
    super(encodeMsg(key, params));
  }
}

export type Issue = {
  rowNumber: number; // رقم الصف في الإكسل (العناوين = 1). صفر = ملاحظة على الملف كله
  requestId: string | null;
  column: string | null;
  severity: "ERROR" | "WARNING";
  message: string;
  rawValue: string | null;
};

export type SenderRecord = {
  rowNumber: number;
  nameKey: string;
  senderName: string;
  requestId: string;
  requestStatus: string;
  requestDate: Date;
  expiryDate: Date | null;
  senderExpiryDate: Date | null;
  senderTypes: string[];
  clientName: string;
  customerType: string | null;
  enterpriseUnifiedNumber: string | null;
  crNumber: string | null;
  representativeName: string | null;
  representativeEmail: string | null;
  representativeMobile: string | null;
  rowHash: string;
};

export type ReadResult = {
  sheetName: string;
  totalRows: number; // كل صفوف البيانات في الملف
  paidRows: number; // صفوف Status = Paid
  failedCount: number; // صفوف Paid رُفضت لخطأ
  duplicateCount: number; // صفوف Paid مكررة لنفس المرسل
  warningCount: number; // كل التحذيرات (حتى ما لم يُحفظ تفصيلياً)
  picked: SenderRecord[]; // صف واحد لكل مرسل
  issues: Issue[];
};

const SENDER_NAME_RE = /^[A-Za-z0-9 ._&-]+$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DIGITS_RE = /^\d+$/;
const MAX_ISSUES = 5000;

const canonical = (value: string, known: string[]) =>
  known.find((k) => k.toLowerCase() === value.toLowerCase()) ?? null;

/** آخر طلب: الأحدث بتاريخ الطلب، ثم بتاريخ انتهاء المرسل، ثم بأكبر Request Id (ثابت مهما تغيّر ترتيب الصفوف). */
function isNewer(a: SenderRecord, b: SenderRecord) {
  const t = (d: Date | null) => (d ? d.getTime() : -Infinity);
  if (t(a.requestDate) !== t(b.requestDate)) return t(a.requestDate) > t(b.requestDate);
  if (t(a.senderExpiryDate) !== t(b.senderExpiryDate)) return t(a.senderExpiryDate) > t(b.senderExpiryDate);
  return a.requestId > b.requestId;
}

function hashRecord(r: Omit<SenderRecord, "rowHash" | "rowNumber" | "nameKey" | "senderName">) {
  const payload = [
    r.requestId,
    r.requestStatus,
    isoDate(r.requestDate),
    isoDate(r.expiryDate),
    isoDate(r.senderExpiryDate),
    r.senderTypes.join("|"),
    r.clientName,
    r.customerType,
    r.enterpriseUnifiedNumber,
    r.crNumber,
    r.representativeName,
    r.representativeEmail,
    r.representativeMobile,
  ];
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function loadSheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    // نقرأ القيم فقط. تجاهل الجداول والتنسيقات يتفادى أعطالاً معروفة في ملفات أعادت حفظها برامج أخرى
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
    throw new ImportFileError("ir.file.unreadable");
  }
  const sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0);
  if (!sheet) throw new ImportFileError("ir.file.empty");
  return sheet;
}

export async function readReport(buffer: Buffer): Promise<ReadResult> {
  const sheet = await loadSheet(buffer);

  // ---- العناوين ----
  const columnIndex = new Map<ColumnKey, number>();
  const wanted = new Map(Object.entries(COLUMNS).map(([key, header]) => [normalizeHeader(header), key as ColumnKey]));
  sheet.getRow(1).eachCell((cell, col) => {
    const header = cleanText(plainCell(cell.value)).text;
    const key = header ? wanted.get(normalizeHeader(header)) : undefined;
    if (key && !columnIndex.has(key)) columnIndex.set(key, col);
  });
  const missing = REQUIRED_COLUMNS.filter((k) => !columnIndex.has(k));
  if (missing.length) {
    throw new ImportFileError("ir.file.missingCols", { cols: missing.map((k) => COLUMNS[k]) });
  }

  const issues: Issue[] = [];
  let warningOverflow = 0;
  let warningCount = 0;
  const addIssue = (issue: Issue) => {
    if (issue.severity === "WARNING") warningCount++;
    if (issues.length < MAX_ISSUES) issues.push(issue);
    else warningOverflow++;
  };

  let totalRows = 0;
  let paidRows = 0;
  let failedCount = 0;
  const valid: SenderRecord[] = [];
  const seenRequestIds = new Map<string, number>();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (key: ColumnKey): CellValue => {
      const col = columnIndex.get(key);
      return col ? plainCell(row.getCell(col).value) : null;
    };
    const text = (key: ColumnKey) => cleanText(get(key));

    // صف فارغ تماماً
    if ([...columnIndex.keys()].every((k) => text(k).text === null)) continue;
    totalRows++;

    // استيراد Paid فقط
    if ((text("status").text ?? "").toLowerCase() !== IMPORTED_STATUS) continue;
    paidRows++;

    const requestId = text("requestId").text;
    const rowErrors: Issue[] = [];
    const rowWarnings: Issue[] = [];
    const issue = (severity: Issue["severity"], key: ColumnKey | null, msgKey: MessageKey | [MessageKey, Params], raw?: CellValue) => {
      const message = Array.isArray(msgKey) ? encodeMsg(msgKey[0], msgKey[1]) : encodeMsg(msgKey);
      const target = severity === "ERROR" ? rowErrors : rowWarnings;
      target.push({
        rowNumber: r,
        requestId,
        column: key ? COLUMNS[key] : null,
        severity,
        message,
        rawValue: raw === undefined || raw === null ? null : String(raw instanceof Date ? isoDate(raw) : raw).slice(0, 500),
      });
    };

    // Request Id
    if (!requestId) issue("ERROR", "requestId", "ir.reqIdEmpty");
    else if (requestId.length > 40) issue("ERROR", "requestId", "ir.reqIdLong", requestId);
    else if (seenRequestIds.has(requestId)) {
      issue("ERROR", "requestId", ["ir.reqIdDup", { row: seenRequestIds.get(requestId) ?? 0 }], requestId);
    }

    // Sender Name
    const senderName = text("senderName").text;
    if (!senderName) issue("ERROR", "senderName", "ir.senderEmpty");
    else if (senderName.length > 11) issue("ERROR", "senderName", "ci.issue.senderLong", senderName);
    else if (!SENDER_NAME_RE.test(senderName)) issue("WARNING", "senderName", "ir.senderOdd", senderName);

    // Client Name
    let clientName = text("clientName").text;
    if (!clientName) issue("ERROR", "clientName", "ir.clientEmpty");
    else if (clientName.length > 255) {
      issue("WARNING", "clientName", "ir.clientLong", clientName);
      clientName = clientName.slice(0, 255);
    }

    // التواريخ
    const rawRequestDate = get("requestDate");
    const requestDate = parseDate(rawRequestDate);
    if (!requestDate.ok) issue("ERROR", "requestDate", "ir.reqDateInvalid", rawRequestDate);
    else if (!requestDate.date) issue("ERROR", "requestDate", "ir.reqDateEmpty");

    const rawExpiry = get("expiryDate");
    const expiry = parseDate(rawExpiry);
    if (!expiry.ok) issue("WARNING", "expiryDate", "ir.expiryInvalid", rawExpiry);

    const rawSenderExpiry = get("senderExpiryDate");
    const senderExpiry = parseDate(rawSenderExpiry);
    if (!senderExpiry.ok) issue("WARNING", "senderExpiryDate", "ir.senderExpiryInvalid", rawSenderExpiry);
    else if (!senderExpiry.date) issue("WARNING", "senderExpiryDate", "ir.senderExpiryEmpty");

    // Sender Type: "Advertisement / Service" ← ["Advertisement","Service"]
    const senderTypes: string[] = [];
    for (const token of (text("senderType").text ?? "").split(/[/,،]+/).map((t) => t.trim()).filter(Boolean)) {
      const known = canonical(token, KNOWN_SENDER_TYPES);
      if (!known) issue("WARNING", "senderType", "ir.senderTypeUnknown", token);
      const value = known ?? token.slice(0, 40);
      if (!senderTypes.includes(value)) senderTypes.push(value);
    }

    // Customer Type
    const rawCustomerType = text("customerType").text;
    let customerType: string | null = null;
    if (rawCustomerType) {
      customerType = canonical(rawCustomerType, KNOWN_CUSTOMER_TYPES);
      if (!customerType) {
        issue("WARNING", "customerType", "ir.customerTypeUnknown", rawCustomerType);
        customerType = rawCustomerType.slice(0, 30);
      }
    }

    // الأرقام الرسمية
    const officialNumber = (key: "enterpriseUnifiedNumber" | "crNumber") => {
      const { text: value, hadInvisible } = text(key);
      if (hadInvisible) issue("WARNING", key, "ir.invisibleRemoved", value);
      if (!value) return null;
      if (!DIGITS_RE.test(value)) issue("WARNING", key, "ir.notDigits", value);
      if (value.length > 40) {
        issue("WARNING", key, "ir.valueLong", value);
        return value.slice(0, 40);
      }
      return value;
    };
    const enterpriseUnifiedNumber = officialNumber("enterpriseUnifiedNumber");
    const crNumber = officialNumber("crNumber");

    // الممثل
    let representativeName = text("representativeName").text;
    if (representativeName && representativeName.length > 150) {
      issue("WARNING", "representativeName", "ir.repNameLong");
      representativeName = representativeName.slice(0, 150);
    }
    let representativeEmail = text("representativeEmail").text?.toLowerCase() ?? null;
    if (representativeEmail && !EMAIL_RE.test(representativeEmail)) {
      issue("WARNING", "representativeEmail", "ir.repEmailInvalid", representativeEmail);
    }
    if (representativeEmail && representativeEmail.length > 254) representativeEmail = representativeEmail.slice(0, 254);
    let representativeMobile = text("representativeMobile").text;
    if (representativeMobile && representativeMobile.length > 20) {
      issue("WARNING", "representativeMobile", "ir.repMobileLong", representativeMobile);
      representativeMobile = representativeMobile.slice(0, 20);
    }

    for (const w of rowWarnings) addIssue(w);
    if (rowErrors.length || !requestId || !senderName || !clientName || !requestDate.ok || !requestDate.date) {
      failedCount++;
      for (const e of rowErrors) addIssue(e);
      continue;
    }
    seenRequestIds.set(requestId, r);

    const base = {
      requestId,
      requestStatus: "Paid",
      requestDate: requestDate.date,
      expiryDate: expiry.ok ? expiry.date : null,
      senderExpiryDate: senderExpiry.ok ? senderExpiry.date : null,
      senderTypes,
      clientName,
      customerType,
      enterpriseUnifiedNumber,
      crNumber,
      representativeName,
      representativeEmail,
      representativeMobile,
    };
    valid.push({ ...base, rowNumber: r, nameKey: senderName.toLowerCase(), senderName, rowHash: hashRecord(base) });
  }

  // ---- إلغاء المكرر: صف واحد لكل مرسل (آخر طلب) ----
  const byName = new Map<string, SenderRecord>();
  for (const rec of valid) {
    const current = byName.get(rec.nameKey);
    if (!current || isNewer(rec, current)) byName.set(rec.nameKey, rec);
  }

  if (warningOverflow > 0) {
    issues.push({
      rowNumber: 0,
      requestId: null,
      column: null,
      severity: "WARNING",
      message: encodeMsg("ir.overflow", { n: warningOverflow, max: MAX_ISSUES }),
      rawValue: null,
    });
  }

  return {
    sheetName: sheet.name.slice(0, 100),
    totalRows,
    paidRows,
    failedCount,
    duplicateCount: valid.length - byName.size,
    warningCount,
    picked: [...byName.values()],
    issues,
  };
}

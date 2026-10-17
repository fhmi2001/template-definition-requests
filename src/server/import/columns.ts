import "server-only";

/**
 * الأعمدة التي تُقرأ من تقرير طلبات العقود. أي عمود آخر في الملف يُتجاهل تماماً
 * (Provider Name، تواريخ تفعيل المشغلين، Payment Date، Tenant Name، ...).
 * المطابقة بالاسم وليس بالترتيب، ولا تتأثر بحالة الأحرف أو المسافات الزائدة.
 */
export const COLUMNS = {
  requestId: "Request Id",
  senderName: "Sender Name",
  clientName: "Client Name",
  requestDate: "Request Date",
  expiryDate: "Expiry Date",
  status: "Status",
  senderExpiryDate: "Sender Expiry Date",
  senderType: "Sender Type",
  customerType: "Customer Type",
  enterpriseUnifiedNumber: "Enterprise Unified Number",
  crNumber: "Cr Number",
  representativeName: "Representative Name",
  representativeEmail: "Representative Email",
  representativeMobile: "Representative Mobile",
} as const;

export type ColumnKey = keyof typeof COLUMNS;

/** بدونها لا يمكن الاستيراد إطلاقاً. */
export const REQUIRED_COLUMNS: ColumnKey[] = [
  "requestId",
  "senderName",
  "clientName",
  "status",
  "requestDate",
  "senderExpiryDate",
];

/** الحالة الوحيدة التي تُستورد. */
export const IMPORTED_STATUS = "paid";

export const KNOWN_SENDER_TYPES = ["Advertisement", "Service", "Awareness", "Warning"];
export const KNOWN_CUSTOMER_TYPES = ["Private", "Government", "Charity"];

export const normalizeHeader = (h: string) => h.replace(/\s+/g, " ").trim().toLowerCase();

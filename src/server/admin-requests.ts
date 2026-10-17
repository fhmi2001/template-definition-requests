import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ReviewStatus } from "@/generated/prisma/enums";
import { isReviewStatus } from "@/lib/review-status";
import { SENDER_TYPES } from "@/lib/sender-types";
import { uuidSchema } from "@/lib/validation";

export const CUSTOMER_TYPES = ["Private", "Government", "Charity"] as const;
export const PAGE_SIZE = 50;

export type RequestFilters = {
  q: string;
  status: ReviewStatus | "all";
  client: string | null;
  senderType: string | null;
  customerType: string | null;
  from: string | null; // YYYY-MM-DD بتوقيت الرياض
  to: string | null;
  sort: "newest" | "oldest";
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** يقرأ الفلاتر من الرابط ويتجاهل أي قيمة غير صالحة. */
export function parseFilters(sp: Params): RequestFilters {
  const status = one(sp.status);
  const client = uuidSchema.safeParse(one(sp.client));
  const senderType = one(sp.senderType);
  const customerType = one(sp.customerType);
  const from = one(sp.from);
  const to = one(sp.to);
  return {
    q: one(sp.q).trim().slice(0, 120),
    status: isReviewStatus(status) ? status : "all",
    client: client.success ? client.data : null,
    senderType: (SENDER_TYPES as readonly string[]).includes(senderType) ? senderType : null,
    customerType: (CUSTOMER_TYPES as readonly string[]).includes(customerType) ? customerType : null,
    from: DAY.test(from) ? from : null,
    to: DAY.test(to) ? to : null,
    sort: one(sp.sort) === "oldest" ? "oldest" : "newest",
    page: Math.max(1, Number.parseInt(one(sp.page) || "1", 10) || 1),
  };
}

/** بداية يوم بتوقيت الرياض (UTC+3) كتاريخ UTC. */
function riyadhDayStart(day: string, addDays = 0) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + addDays) - 3 * 60 * 60 * 1000);
}

/** شروط البحث في الطلبات المقدّمة فقط. */
export function buildWhere(f: RequestFilters, opts: { ignoreStatus?: boolean } = {}): Prisma.TemplateRequestWhereInput {
  const and: Prisma.TemplateRequestWhereInput[] = [{ status: "SUBMITTED" }];
  if (!opts.ignoreStatus && f.status !== "all") and.push({ reviewStatus: f.status });
  if (f.client) and.push({ clientId: f.client });
  if (f.senderType) and.push({ senderType: f.senderType });
  if (f.customerType) and.push({ customerType: { equals: f.customerType, mode: "insensitive" } });
  if (f.from) and.push({ submittedAt: { gte: riyadhDayStart(f.from) } });
  if (f.to) and.push({ submittedAt: { lt: riyadhDayStart(f.to, 1) } });
  if (f.q) {
    const q = f.q;
    const ref = q.match(/^(?:tdr[-\s]?)?0*(\d{1,9})$/i);
    const text = { contains: q, mode: "insensitive" as const };
    and.push({
      OR: [
        ...(ref ? [{ referenceNo: Number(ref[1]) }] : []),
        { templateName: text },
        { templateDescription: text },
        { senderName: text },
        { content: text },
        { awarenessClientName: text },
        { rejectionReason: text },
        { client: { name: text } },
        { user: { email: { contains: q.toLowerCase() } } },
      ],
    });
  }
  return { AND: and };
}

export function orderBy(f: RequestFilters): Prisma.TemplateRequestOrderByWithRelationInput[] {
  return f.sort === "oldest" ? [{ submittedAt: "asc" }, { referenceNo: "asc" }] : [{ submittedAt: "desc" }, { referenceNo: "desc" }];
}

/** رابط بنفس الفلاتر مع تعديل بعضها (للتصفح وشرائح الحالة والتصدير). */
export function filtersQuery(f: RequestFilters, patch: Partial<RequestFilters> = {}) {
  const v = { ...f, ...patch };
  const sp = new URLSearchParams();
  if (v.q) sp.set("q", v.q);
  if (v.status !== "all") sp.set("status", v.status);
  if (v.client) sp.set("client", v.client);
  if (v.senderType) sp.set("senderType", v.senderType);
  if (v.customerType) sp.set("customerType", v.customerType);
  if (v.from) sp.set("from", v.from);
  if (v.to) sp.set("to", v.to);
  if (v.sort !== "newest") sp.set("sort", v.sort);
  if (v.page > 1) sp.set("page", String(v.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const hasFilters = (f: RequestFilters) =>
  !!(f.q || f.status !== "all" || f.client || f.senderType || f.customerType || f.from || f.to || f.sort !== "newest");

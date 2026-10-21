import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export const CLIENTS_PAGE_SIZE = 50;

export const CLIENT_STATUSES = ["active", "disabled", "attention"] as const;
type ClientStatus = (typeof CLIENT_STATUSES)[number];
const SORTS = ["newest", "oldest", "name", "requests"] as const;

export type ClientFilters = {
  q: string;
  status: ClientStatus | "all";
  from: string | null; // YYYY-MM-DD بتوقيت الرياض
  to: string | null;
  sort: (typeof SORTS)[number];
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** يقرأ الفلاتر من الرابط ويتجاهل أي قيمة غير صالحة. */
export function parseClientFilters(sp: Params): ClientFilters {
  const status = one(sp.status);
  const sort = one(sp.sort);
  const from = one(sp.from);
  const to = one(sp.to);
  return {
    q: one(sp.q).trim().slice(0, 120),
    status: (CLIENT_STATUSES as readonly string[]).includes(status) ? (status as ClientStatus) : "all",
    from: DAY.test(from) ? from : null,
    to: DAY.test(to) ? to : null,
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as ClientFilters["sort"]) : "newest",
    page: Math.max(1, Number.parseInt(one(sp.page) || "1", 10) || 1),
  };
}

/** بداية يوم بتوقيت الرياض (UTC+3) كتاريخ UTC. */
function riyadhDayStart(day: string, addDays = 0) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + addDays) - 3 * 60 * 60 * 1000);
}

/** عميل مفعّل لا يستطيع العمل: لا بريد مفعّل للدخول، أو لا أسماء مرسلين يختار منها. */
export const NEEDS_ATTENTION: Prisma.ClientWhereInput = {
  isActive: true,
  OR: [{ users: { none: { isActive: true } } }, { senders: { none: {} } }],
};

const STATUS_WHERE: Record<ClientStatus, Prisma.ClientWhereInput> = {
  active: { isActive: true },
  disabled: { isActive: false },
  attention: NEEDS_ATTENTION,
};

/** شروط البحث: الاسم والملاحظات والبريد واسم المرسل ورقم السجل التجاري والرقم الموحد (من بيانات المرسلين). */
export function buildClientWhere(f: ClientFilters, opts: { ignoreStatus?: boolean } = {}): Prisma.ClientWhereInput {
  const and: Prisma.ClientWhereInput[] = [];
  if (!opts.ignoreStatus && f.status !== "all") and.push(STATUS_WHERE[f.status]);
  if (f.from) and.push({ createdAt: { gte: riyadhDayStart(f.from) } });
  if (f.to) and.push({ createdAt: { lt: riyadhDayStart(f.to, 1) } });
  if (f.q) {
    const text = { contains: f.q, mode: "insensitive" as const };
    const lower = f.q.toLowerCase();
    and.push({
      OR: [
        { name: text },
        { notes: text },
        { users: { some: { email: { contains: lower } } } },
        { senders: { some: { nameKey: { contains: lower } } } },
        { senders: { some: { crNumber: text } } },
        { senders: { some: { enterpriseUnifiedNumber: text } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export function clientOrderBy(f: ClientFilters): Prisma.ClientOrderByWithRelationInput[] {
  switch (f.sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "requests":
      return [{ requests: { _count: "desc" } }, { name: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

/** ما يُعرض ويُصدَّر لكل عميل. */
export const clientRowSelect = {
  id: true,
  name: true,
  notes: true,
  isActive: true,
  createdAt: true,
  users: { orderBy: [{ isActive: "desc" }, { createdAt: "asc" }], select: { id: true, email: true, isActive: true } },
  senders: { orderBy: { nameKey: "asc" }, select: { id: true, name: true, crNumber: true, enterpriseUnifiedNumber: true } },
  _count: { select: { requests: { where: { status: "SUBMITTED" } } } },
} satisfies Prisma.ClientSelect;

export type ClientRow = Prisma.ClientGetPayload<{ select: typeof clientRowSelect }>;

/** القيم المختلفة غير الفارغة (أرقام السجل التجاري لمرسلي العميل مثلاً). */
export const distinct = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v?.trim()))];

export function rowNeedsAttention(c: ClientRow) {
  return c.isActive && (!c.users.some((u) => u.isActive) || c.senders.length === 0);
}

/** رابط بنفس الفلاتر مع تعديل بعضها (للتصفح وشرائح الحالة والتصدير). */
export function clientFiltersQuery(f: ClientFilters, patch: Partial<ClientFilters> = {}) {
  const v = { ...f, ...patch };
  const sp = new URLSearchParams();
  if (v.q) sp.set("q", v.q);
  if (v.status !== "all") sp.set("status", v.status);
  if (v.from) sp.set("from", v.from);
  if (v.to) sp.set("to", v.to);
  if (v.sort !== "newest") sp.set("sort", v.sort);
  if (v.page > 1) sp.set("page", String(v.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const hasClientFilters = (f: ClientFilters) => !!(f.q || f.status !== "all" || f.from || f.to || f.sort !== "newest");

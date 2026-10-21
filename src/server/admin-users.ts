import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** حسابات فريق لوحة الإدارة (جدول admins). بريد العملاء يُدار من صفحة كل عميل. */

export const USERS_PAGE_SIZE = 50;
export const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
const SORTS = ["newest", "oldest", "name", "lastLogin"] as const;

export type AdminFilters = {
  q: string;
  role: AdminRole | "all";
  status: "all" | "active" | "disabled";
  from: string | null; // YYYY-MM-DD بتوقيت الرياض
  to: string | null;
  sort: (typeof SORTS)[number];
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseAdminFilters(sp: Params): AdminFilters {
  const role = one(sp.role);
  const status = one(sp.status);
  const sort = one(sp.sort);
  const from = one(sp.from);
  const to = one(sp.to);
  return {
    q: one(sp.q).trim().slice(0, 120),
    role: (ADMIN_ROLES as readonly string[]).includes(role) ? (role as AdminRole) : "all",
    status: status === "active" || status === "disabled" ? status : "all",
    from: DAY.test(from) ? from : null,
    to: DAY.test(to) ? to : null,
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as AdminFilters["sort"]) : "newest",
    page: Math.max(1, Number.parseInt(one(sp.page) || "1", 10) || 1),
  };
}

/** بداية يوم بتوقيت الرياض (UTC+3) كتاريخ UTC. */
function riyadhDayStart(day: string, addDays = 0) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + addDays) - 3 * 60 * 60 * 1000);
}

export function buildAdminWhere(f: AdminFilters, opts: { ignoreRole?: boolean } = {}): Prisma.AdminWhereInput {
  const and: Prisma.AdminWhereInput[] = [];
  if (!opts.ignoreRole && f.role !== "all") and.push({ role: f.role });
  if (f.status !== "all") and.push({ isActive: f.status === "active" });
  if (f.from) and.push({ createdAt: { gte: riyadhDayStart(f.from) } });
  if (f.to) and.push({ createdAt: { lt: riyadhDayStart(f.to, 1) } });
  if (f.q) {
    const text = { contains: f.q, mode: "insensitive" as const };
    and.push({ OR: [{ username: text }, { displayName: text }, { email: text }] });
  }
  return and.length ? { AND: and } : {};
}

export function adminOrderBy(f: AdminFilters): Prisma.AdminOrderByWithRelationInput[] {
  switch (f.sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "name":
      return [{ username: "asc" }];
    case "lastLogin":
      return [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { id: "desc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

/** ما يُعرض ويُصدَّر لكل حساب. لا يتضمن كلمة المرور أبداً. */
export const adminRowSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  role: true,
  isActive: true,
  lockedUntil: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.AdminSelect;

export function adminFiltersQuery(f: AdminFilters, patch: Partial<AdminFilters> = {}) {
  const v = { ...f, ...patch };
  const sp = new URLSearchParams();
  if (v.q) sp.set("q", v.q);
  if (v.role !== "all") sp.set("role", v.role);
  if (v.status !== "all") sp.set("status", v.status);
  if (v.from) sp.set("from", v.from);
  if (v.to) sp.set("to", v.to);
  if (v.sort !== "newest") sp.set("sort", v.sort);
  if (v.page > 1) sp.set("page", String(v.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const hasAdminFilters = (f: AdminFilters) => !!(f.q || f.role !== "all" || f.status !== "all" || f.from || f.to || f.sort !== "newest");

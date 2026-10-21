import "server-only";
import { db } from "@/server/db";
import { getAdminSession, isSuperAdmin } from "@/server/auth/dal";
import { getT } from "@/i18n/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { adminOrderBy, adminRowSelect, buildAdminWhere, parseAdminFilters } from "@/server/admin-users";

/** التصدير للمشرف الرئيسي وحده، مثل الصفحة نفسها. */
export async function canExportAdmins() {
  const s = await getAdminSession();
  return !!s && isSuperAdmin(s.admin);
}

/** جدول حسابات الإدارة للتصدير بنفس فلاتر الصفحة. لا يتضمن أي بيانات كلمات مرور. */
export async function usersExportTable(url: string) {
  const { t, locale } = await getT();
  const f = parseAdminFilters(Object.fromEntries(new URL(url).searchParams));
  const admins = await db.admin.findMany({ where: buildAdminWhere(f), orderBy: adminOrderBy(f), select: adminRowSelect });
  const header = [t("users.f.name"), t("users.f.username"), t("login.email"), t("users.f.role"), t("col.status"), t("col.lastLogin"), t("users.th.created")];
  const rows = admins.map((a) => [
    a.displayName ?? "",
    a.username,
    a.email ?? "",
    a.role === "SUPER_ADMIN" ? t("admin.superAdmin") : t("admin.admin"),
    a.isActive ? t("state.activeM") : t("state.disabledM"),
    a.lastLoginAt ? formatDateTime(a.lastLoginAt, locale) : "",
    formatDate(a.createdAt, locale),
  ]);
  return { header, rows, locale };
}

import "server-only";
import { db } from "@/server/db";
import { getT } from "@/i18n/server";
import { formatDate } from "@/lib/format";
import { buildClientWhere, clientOrderBy, clientRowSelect, distinct, parseClientFilters, rowNeedsAttention } from "@/server/admin-clients";

const MAX_ROWS = 20_000;

/** جدول العملاء للتصدير بنفس فلاتر الصفحة: صف العناوين ثم صف لكل عميل. */
export async function clientsExportTable(url: string) {
  const { t, locale } = await getT();
  const f = parseClientFilters(Object.fromEntries(new URL(url).searchParams));
  const clients = await db.client.findMany({
    where: buildClientWhere(f),
    orderBy: clientOrderBy(f),
    take: MAX_ROWS,
    select: clientRowSelect,
  });

  const header = [
    t("col.client"),
    t("clients.notes"),
    t("col.status"),
    t("clients.st.attention"),
    t("clients.emails"),
    `${t("clients.emails")} (${t("state.disabledM")})`,
    t("col.senders"),
    t("ent.cr"),
    t("ent.unified"),
    t("clients.th.requests"),
    t("col.addedOn"),
  ];
  const rows = clients.map((c) => [
    c.name,
    c.notes ?? "",
    c.isActive ? t("state.activeM") : t("state.disabledM"),
    rowNeedsAttention(c) ? t("clients.st.attention") : "",
    c.users.filter((u) => u.isActive).map((u) => u.email).join(", "),
    c.users.filter((u) => !u.isActive).map((u) => u.email).join(", "),
    c.senders.map((s) => s.name).join(", "),
    distinct(c.senders.map((s) => s.crNumber)).join(", "),
    distinct(c.senders.map((s) => s.enterpriseUnifiedNumber)).join(", "),
    c._count.requests,
    formatDate(c.createdAt, locale),
  ]);
  return { header, rows, locale };
}

export const exportStamp = () => new Date().toISOString().slice(0, 10);

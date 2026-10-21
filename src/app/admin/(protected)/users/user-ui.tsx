import type { T } from "@/i18n/translate";

export const roleLabel = (t: T, role: string) => (role === "SUPER_ADMIN" ? t("admin.superAdmin") : t("admin.admin"));

/** المشرف الرئيسي بلون الليل (غرفة الإدارة)، والمشرف بلون محايد. */
export function RoleTag({ role, t }: { role: string; t: T }) {
  const cls = role === "SUPER_ADMIN" ? "bg-night text-white" : "bg-chip text-ink-2";
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-meta font-semibold ${cls}`}>{roleLabel(t, role)}</span>;
}

export function StatusChip({ active, locked, t }: { active: boolean; locked?: boolean; t: T }) {
  if (!active) return <span className="inline-flex whitespace-nowrap rounded-full bg-chip px-2.5 py-1 text-meta font-semibold text-ink-2">{t("state.disabledM")}</span>;
  if (locked) return <span className="inline-flex whitespace-nowrap rounded-full bg-warn-50 px-2.5 py-1 text-meta font-semibold text-warn-700">{t("users.locked")}</span>;
  return <span className="inline-flex whitespace-nowrap rounded-full bg-brand-50 px-2.5 py-1 text-meta font-semibold text-brand-700">{t("state.activeM")}</span>;
}

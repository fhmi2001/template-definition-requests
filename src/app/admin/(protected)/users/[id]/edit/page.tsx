import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { db } from "@/server/db";
import { requireSuperAdmin } from "@/server/auth/dal";
import { adminRowSelect } from "@/server/admin-users";
import { uuidSchema } from "@/lib/validation";
import { formatDateTime } from "@/lib/format";
import { Alert } from "@/components/ui";
import { EditAdminForm, ResetPasswordForm, StatusToggle } from "../../user-forms";
import { RoleTag, StatusChip } from "../../user-ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("users.edit") };
}

const card = "flex flex-col gap-5 rounded-2xl border border-line bg-white p-6";

export default async function EditAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { admin: me } = await requireSuperAdmin();
  const { t, locale } = await getT();
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const a = await db.admin.findUnique({ where: { id: id.data }, select: adminRowSelect });
  if (!a) notFound();
  const created = (await searchParams).created === "1";
  const self = a.id === me.id;
  const locked = !!a.lockedUntil && a.lockedUntil > new Date();
  const title = a.displayName ?? a.username;

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="text-meta text-muted">
          <Link href="/admin/users" className="text-brand-700 underline-offset-4 hover:underline">
            {t("users.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span> {title}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="break-words text-page font-bold">{title}</h1>
            {title !== a.username ? (
              <p dir="ltr" className="font-mono text-small text-muted">
                {a.username}
              </p>
            ) : null}
            <p className="text-meta tabular-nums text-muted">
              {t("users.meta", { created: formatDateTime(a.createdAt, locale), login: a.lastLoginAt ? formatDateTime(a.lastLoginAt, locale) : t("users.never") })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RoleTag role={a.role} t={t} />
            <StatusChip active={a.isActive} locked={locked} t={t} />
          </div>
        </div>
      </div>

      {created ? <Alert tone="success">{t("users.ok.createdAdmin")}</Alert> : null}
      {locked ? <Alert tone="warning">{t("users.lockedNote")}</Alert> : null}
      {a.email ? null : <Alert tone="warning">{t("users.noEmailNote")}</Alert>}

      <section aria-labelledby="details-title" className={card}>
        <h2 id="details-title" className="text-title font-bold">
          {t("users.details")}
        </h2>
        <EditAdminForm admin={{ id: a.id, name: a.displayName, email: a.email, role: a.role }} canChangeRole={!self} />
      </section>

      <section aria-labelledby="password-title" className={card}>
        <div className="flex flex-col gap-1">
          <h2 id="password-title" className="text-title font-bold">
            {t("users.resetPassword")}
          </h2>
          <p className="text-meta text-muted">{t("users.resetIntro")}</p>
        </div>
        <ResetPasswordForm adminId={a.id} self={self} />
      </section>

      <section aria-labelledby="access-title" className={card}>
        <div className="flex flex-col gap-1">
          <h2 id="access-title" className="text-title font-bold">
            {t("users.access")}
          </h2>
          <p className="text-meta text-muted">{a.isActive ? t("users.accessActive") : t("users.accessDisabled")}</p>
        </div>
        {self ? <p className="text-small text-muted">{t("users.err.selfDisable")}</p> : <StatusToggle id={a.id} isActive={a.isActive} label={a.username} />}
      </section>
    </div>
  );
}

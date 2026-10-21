import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireSuperAdmin } from "@/server/auth/dal";
import { NewAdminForm } from "../user-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("users.add") };
}

export default async function NewAdminPage() {
  await requireSuperAdmin();
  const { t } = await getT();
  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="text-meta text-muted">
          <Link href="/admin/users" className="text-brand-700 underline-offset-4 hover:underline">
            {t("users.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span> {t("users.add")}
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-page font-bold">{t("users.add")}</h1>
          <p className="text-small text-muted">{t("users.new.intro")}</p>
        </div>
      </div>
      <section aria-label={t("users.add")} className="rounded-2xl border border-line bg-white p-6">
        <NewAdminForm />
      </section>
    </div>
  );
}

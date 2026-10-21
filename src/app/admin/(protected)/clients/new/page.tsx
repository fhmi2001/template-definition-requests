import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/dal";
import { CreateClientForm } from "../client-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("clients.add") };
}

/** إضافة عميل يدوياً، في صفحة مستقلة عن القائمة. */
export default async function NewClientPage() {
  await requireAdmin();
  const { t } = await getT();
  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="text-meta text-muted">
          <Link href="/admin/clients" className="text-brand-700 underline-offset-4 hover:underline">
            {t("clients.title")}
          </Link>{" "}
          <span aria-hidden="true">/</span> {t("clients.add")}
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-page font-bold">{t("clients.add")}</h1>
          <p className="text-small text-muted">{t("clients.new.intro")}</p>
        </div>
      </div>
      <section aria-label={t("clients.add")} className="rounded-2xl border border-line bg-white p-6">
        <CreateClientForm />
      </section>
    </div>
  );
}

import Link from "next/link";
import { Alert } from "@/components/ui";
import { getT } from "@/i18n/server";

/** بطاقة صغيرة باسم المرسل المختار (وما اختير بعده) مع رابط للتغيير. */
export async function ChosenSender({
  name,
  clientName,
  extra,
  changeHref,
}: {
  name: string;
  clientName: string | null;
  extra?: { label: string; value: string }[];
  changeHref: string;
}) {
  const { t } = await getT();
  return (
    <section aria-label={t("chosen.aria")} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white px-5 py-4">
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[12px] text-muted">{t("col.senderName")}</dt>
          <dd dir="ltr" className="font-mono text-base font-medium">
            {name}
          </dd>
        </div>
        {clientName ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-[12px] text-muted">{t("col.clientName")}</dt>
            <dd className="text-[15px]">{clientName}</dd>
          </div>
        ) : null}
        {extra?.map((e) => (
          <div key={e.label} className="flex flex-col gap-0.5">
            <dt className="text-[12px] text-muted">{e.label}</dt>
            <dd className="text-[15px]">{e.value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href={changeHref}
        className="inline-flex min-h-10 items-center rounded-[10px] border border-field bg-white px-3.5 text-sm font-semibold hover:bg-canvas"
      >
        {t("chosen.change")}
      </Link>
    </section>
  );
}

/** المرسل لم يعد مرتبطاً بالعميل أو عُطّل بعد اختياره. */
export async function SenderGone({ changeHref }: { changeHref: string }) {
  const { t } = await getT();
  return (
    <div className="flex flex-col gap-4">
      <Alert>{t("gone.message")}</Alert>
      <div>
        <Link href={changeHref} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
          {t("gone.back")}
        </Link>
      </div>
    </div>
  );
}

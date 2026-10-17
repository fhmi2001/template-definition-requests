import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui";
import { LinkButton } from "@/components/link-button";
import { PageHeader, RequestSteps } from "@/components/user-shell";
import { getT } from "@/i18n/server";

/** رأس كل مرحلة: شريط المراحل ثم العنوان والوصف. */
export function StepHeader({ current, draftId, title, intro }: { current: number; draftId?: string; title: string; intro: string }) {
  return (
    <div className="flex flex-col gap-7">
      <RequestSteps current={current} draftId={draftId} />
      <PageHeader title={title} intro={intro} />
    </div>
  );
}

/** شريط ما اختاره العميل في المراحل السابقة، مع رابط لتغيير اسم المرسل. */
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
    <section
      aria-label={t("chosen.aria")}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-line bg-white px-5 py-3.5"
    >
      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex size-8 flex-none items-center justify-center rounded-full bg-brand-400 text-[13px] font-bold text-white">
            {name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="flex flex-col">
            <dt className="text-[13px] text-muted">{t("col.senderName")}</dt>
            <dd dir="ltr" className="font-mono text-[15px] font-semibold leading-tight">
              {name}
            </dd>
          </div>
        </div>
        {clientName ? <Item label={t("col.clientName")}>{clientName}</Item> : null}
        {extra?.map((e) => (
          <Item key={e.label} label={e.label}>
            {e.value}
          </Item>
        ))}
      </dl>
      <Link href={changeHref} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
        {t("chosen.change")}
      </Link>
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:border-s sm:border-hair sm:ps-6">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-[14px] font-medium leading-tight">{children}</dd>
    </div>
  );
}

/** المرسل لم يعد مرتبطاً بالعميل أو عُطّل بعد اختياره. */
export async function SenderGone({ changeHref }: { changeHref: string }) {
  const { t } = await getT();
  return (
    <div className="flex flex-col gap-4">
      <Alert>{t("gone.message")}</Alert>
      <div>
        <LinkButton href={changeHref}>{t("gone.back")}</LinkButton>
      </div>
    </div>
  );
}

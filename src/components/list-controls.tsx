import Link from "next/link";
import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import { getT } from "@/i18n/server";
import { LinkButton } from "./link-button";

/** شريط تصفية بشارات: كل شارة رابط، والمختارة عليها aria-current. */
export function FilterChips({ label, items }: { label: string; items: { key: string; href: string; label: ReactNode; count?: number; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          aria-current={it.active ? "page" : undefined}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors ${
            it.active ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-line-strong bg-white text-ink hover:bg-canvas"
          }`}
        >
          {it.label}
          {it.count !== undefined ? (
            <span dir="ltr" className={`font-mono ${it.active ? "" : "text-muted"}`}>
              {formatNumber(it.count)}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** ترقيم الصفحات: ملخص + «السابق» و«التالي». */
export async function Pager({ summary, prevHref, nextHref }: { summary: ReactNode; prevHref?: string | null; nextHref?: string | null }) {
  const { t } = await getT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
      <span>{summary}</span>
      <div className="flex gap-2">
        {prevHref ? (
          <LinkButton href={prevHref} size="sm">
            {t("common.previous")}
          </LinkButton>
        ) : null}
        {nextHref ? (
          <LinkButton href={nextHref} size="sm">
            {t("common.next")}
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}

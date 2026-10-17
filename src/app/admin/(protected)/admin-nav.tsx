"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translate";

const items: { href: string; label: MessageKey; ready: boolean }[] = [
  { href: "/admin/requests", label: "nav.requests", ready: true },
  { href: "/admin/clients", label: "nav.clients", ready: true },
  { href: "/admin/senders", label: "nav.senders", ready: true },
  { href: "/admin/imports", label: "nav.imports", ready: true },
];

export function AdminNav() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav aria-label={t("nav.label")} className="flex flex-col gap-1">
      {items.map((item) => {
        if (!item.ready) {
          return (
            <span key={item.href} className="flex min-h-11 items-center justify-between gap-2 rounded-[10px] px-3 text-sm text-[#8fa69d]">
              {t(item.label)}
              <span className="rounded-full bg-[#1e3c33] px-2 py-0.5 text-[11px]">{t("nav.soon")}</span>
            </span>
          );
        }
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-[10px] px-3 text-sm ${
              active ? "bg-night-2 font-semibold text-white" : "text-[#cfe3db] hover:bg-night-2"
            }`}
          >
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

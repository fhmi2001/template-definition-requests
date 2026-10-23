"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translate";

const icon = (d: string): ReactNode => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
    <path d={d} />
  </svg>
);

const items: { href: string; label: MessageKey; icon: ReactNode; superOnly?: boolean }[] = [
  { href: "/admin/requests", label: "nav.requests", icon: icon("M4 5h16v11H8l-4 4V5z") },
  { href: "/admin/clients", label: "nav.clients", icon: icon("M4 21V7l8-4 8 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01") },
  { href: "/admin/senders", label: "nav.senders", icon: icon("M12 12a4 4 0 1 0-4-4M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1") },
  { href: "/admin/imports", label: "nav.imports", icon: icon("M12 16V4M7 9l5-5 5 5M4 20h16") },
  // فريق الإدارة: للمشرف الرئيسي وحده (الصفحة نفسها تتحقق من ذلك في الخادم)
  { href: "/admin/users", label: "nav.users", icon: icon("M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"), superOnly: true },
];

/** قائمة الإدارة: عمودية في الشاشات الواسعة، وشريط أفقي قابل للتمرير على الجوال. */
export function AdminNav({ superAdmin = false }: { superAdmin?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav aria-label={t("nav.label")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {items
        .filter((item) => superAdmin || !item.superOnly)
        .map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 flex-none items-center gap-3 rounded-xl px-3.5 text-small transition-colors lg:flex-auto ${
                active ? "rounded-ss-sm bg-brand-600 font-semibold text-white" : "text-night-fg hover:bg-night-2"
              }`}
            >
              {item.icon}
              {t(item.label)}
            </Link>
          );
        })}
    </nav>
  );
}

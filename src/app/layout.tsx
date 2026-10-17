import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { getLocale, getT } from "@/i18n/server";
import { dirOf } from "@/i18n/config";
import { I18nProvider } from "@/i18n/client";
import "./globals.css";

// الخطوط تُستضاف مع التطبيق وتُحمَّل مسبقاً (بدل ملف CSS خارجي من Google يؤخر ظهور الصفحة)
const sans = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t("app.name"), template: t("app.titleTemplate") },
    description: "Template Definition Requests",
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}

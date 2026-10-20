import type { ReactNode } from "react";
import { getT } from "@/i18n/server";
import { BrandLogo } from "@/components/brand";

/*
 * هياكل تحميل (loading.tsx): تظهر فوراً عند التنقل بدل بقاء الصفحة السابقة بلا استجابة
 * حتى يصل رد الخادم. تتبع شكل الصفحات نفسها حتى لا تقفز العناصر عند وصول المحتوى.
 */

function Bar({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block rounded-lg bg-chip motion-safe:animate-pulse ${className}`} />;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>{children}</div>;
}

async function Loading() {
  const { t } = await getT();
  return (
    <p role="status" className="sr-only">
      {t("common.loading")}
    </p>
  );
}

function PageTitle() {
  return (
    <div className="flex flex-col gap-3">
      <Bar className="h-8 w-56 sm:h-9" />
      <Bar className="h-4 w-full max-w-[520px]" />
    </div>
  );
}

/** صفحات العميل: نفس الشريط العلوي (الشعار) ثم المحتوى. */
export async function ClientPageSkeleton({ variant }: { variant: "picker" | "steps" | "list" }) {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <BrandLogo product={t("app.name")} />
          <div className="hidden gap-2 sm:flex">
            <Bar className="h-10 w-28" />
            <Bar className="h-10 w-24" />
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Bar className="h-10 w-14" />
            <Bar className="size-10 rounded-full" />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
        <Loading />
        {variant !== "list" ? (
          <div aria-hidden="true" className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="h-1.5 rounded-full bg-line" />
            ))}
          </div>
        ) : null}
        <PageTitle />
        {variant === "picker" ? (
          <>
            <Bar className="h-12 w-full max-w-[520px] rounded-xl" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="min-h-[104px] p-4 sm:p-4">
                  <div className="flex items-center gap-2.5">
                    <Bar className="size-9 rounded-full" />
                    <Bar className="h-4 w-28" />
                  </div>
                  <Bar className="h-3.5 w-40" />
                </Card>
              ))}
            </div>
          </>
        ) : variant === "steps" ? (
          <>
            <Bar className="h-14 w-full rounded-2xl" />
            <Card>
              <Bar className="h-5 w-40" />
              <Bar className="h-28 w-full rounded-xl" />
              <Bar className="h-4 w-2/3" />
            </Card>
            <Card>
              <Bar className="h-5 w-32" />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-5/6" />
            </Card>
          </>
        ) : (
          <Card className="p-0 sm:p-0">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-hair px-5 py-4 last:border-0">
                <Bar className="h-4 w-24" />
                <Bar className="h-4 flex-1" />
                <Bar className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </Card>
        )}
      </main>
    </div>
  );
}

/** صفحات الإدارة: داخل التخطيط (الشريط الجانبي يبقى)، والمحتوى فقط هيكل. */
export async function AdminPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Loading />
      <PageTitle />
      <Card className="p-0 sm:p-0">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hair px-5 py-4 last:border-0">
            <Bar className="h-4 w-24" />
            <Bar className="h-4 w-32" />
            <Bar className="h-4 flex-1" />
            <Bar className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}

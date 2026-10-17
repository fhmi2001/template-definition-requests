"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** يعيد تحميل بيانات الصفحة كل ثانيتين ما دام الاستيراد جارياً. */
export function AutoRefresh({ everyMs = 2000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}

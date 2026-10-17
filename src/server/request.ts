import "server-only";
import { headers } from "next/headers";

/** عنوان IP والمتصفح لطلب الحالي (للتسجيل وحد المحاولات). */
export async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (forwarded || h.get("x-real-ip") || "unknown").slice(0, 45);
  const userAgent = (h.get("user-agent") ?? "").slice(0, 500);
  return { ip, userAgent };
}

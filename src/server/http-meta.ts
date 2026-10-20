import "server-only";
import { headers } from "next/headers";

/**
 * عنوان IP والمتصفح لطلب الحالي (للتسجيل وحد المحاولات).
 * أول قيمة في X-Forwarded-For يكتبها المتصفح نفسه، فلا يُعتمد عليها: تزويرها يتجاوز حد المحاولات لكل IP.
 * نأخذ ما تضعه منصة الاستضافة (Netlify)، وإلا آخر عنوان في السلسلة (الذي أضافه الوكيل الأقرب).
 */
export async function requestMeta() {
  const h = await headers();
  const chain = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  const ip = (h.get("x-nf-client-connection-ip") || h.get("x-real-ip") || chain?.at(-1) || "unknown").slice(0, 45);
  const userAgent = (h.get("user-agent") ?? "").slice(0, 500);
  return { ip, userAgent };
}

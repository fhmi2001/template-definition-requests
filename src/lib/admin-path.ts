/**
 * رابط دخول الأدمن.
 * المستودع عام، لذلك الرابط الحقيقي لا يُكتب في الكود: يُقرأ من ADMIN_LOGIN_PATH
 * (16 حرفاً على الأقل من A-Z a-z 0-9 _ -) ويصبح /admin/<القيمة>.
 * المسار الداخلي /admin/login يبقى للصفحة نفسها، لكنه يعيد 404 عند فتحه مباشرة.
 * بدون المتغير (التطوير) يعمل /admin/login كما هو.
 */
export const ADMIN_LOGIN_ROUTE = "/admin/login";

export function adminLoginPath() {
  const slug = process.env.ADMIN_LOGIN_PATH?.trim();
  return slug && /^[A-Za-z0-9_-]{16,}$/.test(slug) ? `/admin/${slug}` : ADMIN_LOGIN_ROUTE;
}

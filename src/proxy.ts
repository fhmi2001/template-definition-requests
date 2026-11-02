import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN_ROUTE, adminLoginPath } from "@/lib/admin-path";

/**
 * مسار داخلي على نفس الأصل: نعدّل نسخة من nextUrl بدل new URL(path, request.url).
 * خلف وكيل (nginx) قد يختلف أصل request.url عن أصل الخادم، فيعامل Next إعادة الكتابة كوكيل خارجي
 * (https://localhost:PORT) ويفشل الاتصال → خطأ 500 في صفحة دخول الأدمن.
 */
const internal = (request: NextRequest, path: string) => {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return url;
};

/** صفحة 404 عادية: لا نكشف أن هناك لوحة إدارة خلف هذا المسار. */
const notFound = (request: NextRequest) => NextResponse.rewrite(internal(request, "/_admin-not-found"), { status: 404 });

/**
 * تحويل مبدئي سريع فقط. التحقق الحقيقي من الجلسة يتم في الصفحات والـ actions عبر src/server/auth/dal.ts.
 * - رابط الأدمن السري يُعرض من صفحة /admin/login دون تغيير العنوان.
 * - من لا يملك جلسة أدمن يرى 404 في كل مسارات /admin، فلا يُوجَّه إلى صفحة الدخول.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const loginPath = adminLoginPath();
    const hidden = loginPath !== ADMIN_LOGIN_ROUTE;
    if (hidden && pathname === loginPath) return NextResponse.rewrite(internal(request, ADMIN_LOGIN_ROUTE));
    if (pathname === ADMIN_LOGIN_ROUTE) return hidden ? notFound(request) : NextResponse.next();
    if (!request.cookies.has("tdr_admin")) return notFound(request);
  }

  if ((pathname.startsWith("/home") || pathname.startsWith("/request")) && !request.cookies.has("tdr_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/home/:path*", "/request/:path*", "/requests"],
};

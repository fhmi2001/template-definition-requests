import { NextResponse, type NextRequest } from "next/server";

/**
 * تحويل مبدئي سريع فقط: من لا يملك كوكي الجلسة يُرسل لصفحة الدخول.
 * التحقق الحقيقي من الجلسة يتم في الصفحات والـ actions عبر src/server/auth/dal.ts.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !request.cookies.has("tdr_admin")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if ((pathname.startsWith("/home") || pathname.startsWith("/request")) && !request.cookies.has("tdr_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/home/:path*", "/request/:path*"],
};

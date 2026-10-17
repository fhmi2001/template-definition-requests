import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { ADMIN_COOKIE, USER_COOKIE, readSessionId } from "@/server/auth/session";

/**
 * طبقة الوصول للبيانات (DAL): الفحص الحقيقي للجلسة يتم هنا في كل صفحة وكل action،
 * وليس في proxy.ts الذي يكتفي بتحويل مبدئي.
 */
export const getUserSession = cache(async () => {
  const sid = await readSessionId((await cookies()).get(USER_COOKIE)?.value, "USER");
  if (!sid) return null;
  const session = await db.session.findUnique({
    where: { id: sid },
    include: { user: { include: { client: true } } },
  });
  if (!session || session.actor !== "USER" || session.revokedAt || session.expiresAt <= new Date()) return null;
  const user = session.user;
  if (!user || !user.isActive || !user.client.isActive) return null;
  return { sessionId: session.id, user, client: user.client };
});

export async function requireUser() {
  const s = await getUserSession();
  if (!s) redirect("/login");
  return s;
}

export const getAdminSession = cache(async () => {
  const sid = await readSessionId((await cookies()).get(ADMIN_COOKIE)?.value, "ADMIN");
  if (!sid) return null;
  const session = await db.session.findUnique({ where: { id: sid }, include: { admin: true } });
  if (!session || session.actor !== "ADMIN" || session.revokedAt || session.expiresAt <= new Date()) return null;
  const admin = session.admin;
  // تغيير كلمة المرور يلغي الجلسات الأقدم منه
  if (!admin || !admin.isActive || session.createdAt < admin.passwordChangedAt) return null;
  return { sessionId: session.id, admin };
});

export async function requireAdmin() {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  return s;
}

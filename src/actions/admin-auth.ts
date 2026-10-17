"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requestMeta } from "@/server/http-meta";
import { audit } from "@/server/audit";
import { verifyPassword } from "@/server/auth/password";
import { hitRateLimit, waitText } from "@/server/auth/rate-limit";
import { createAdminSession, destroySession } from "@/server/auth/session";
import { getAdminSession } from "@/server/auth/dal";
import { adminLoginSchema, fieldErrors } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
import { getT } from "@/i18n/server";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function adminLoginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getT();
  const parsed = adminLoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  const username = String(formData.get("username") ?? "");
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.x), values: { username } };

  const meta = await requestMeta();
  const byIp = await hitRateLimit(`admin-login:ip:${meta.ip}`, 10, 15 * 60);
  if (!byIp.allowed) {
    return { error: t("auth.tooManyDevice", { wait: waitText(byIp.retryAfterSec, t) }), tone: "warning", values: { username } };
  }

  const admin = await db.admin.findUnique({ where: { username: parsed.data.username } });

  if (admin?.lockedUntil && admin.lockedUntil > new Date()) {
    const sec = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 1000);
    return { error: t("adminLogin.locked", { wait: waitText(sec, t) }), tone: "warning", values: { username } };
  }

  const valid = await verifyPassword(admin?.passwordHash ?? null, parsed.data.password);

  if (!admin || !valid || !admin.isActive) {
    if (admin) {
      const failed = admin.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED;
      await db.admin.update({
        where: { id: admin.id },
        data: lock
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) }
          : { failedLoginCount: failed },
      });
      await audit({ adminId: admin.id, action: lock ? "admin.locked" : "admin.login_failed", entityType: "admin", entityId: admin.id, ip: meta.ip });
      if (lock) {
        return { error: t("adminLogin.lockedNow", { minutes: LOCK_MINUTES, max: MAX_FAILED }), tone: "warning", values: { username } };
      }
    }
    return { error: t("adminLogin.invalid"), values: { username } };
  }

  await db.admin.update({
    where: { id: admin.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createAdminSession(admin.id, meta);
  await audit({ adminId: admin.id, action: "admin.login", entityType: "admin", entityId: admin.id, ip: meta.ip });
  redirect("/admin/clients");
}

export async function adminLogoutAction() {
  const s = await getAdminSession();
  await destroySession("ADMIN");
  if (s) await audit({ adminId: s.admin.id, action: "admin.logout", entityType: "admin", entityId: s.admin.id });
  redirect("/admin/login");
}

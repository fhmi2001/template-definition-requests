import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** يسجّل عملية أدمن في audit_logs. فشل التسجيل لا يوقف العملية الأصلية. */
export async function audit(entry: {
  adminId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ipAddress: entry.ip,
      },
    });
  } catch (err) {
    console.error("[audit] تعذّر تسجيل العملية", entry.action, err);
  }
}

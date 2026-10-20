import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // على الاستضافة السحابية تعمل نسخ كثيرة صغيرة في نفس الوقت: اتصالات قليلة لكل نسخة
  // حتى لا تُستنفد اتصالات Supabase (استخدم رابط Transaction pooler على المنفذ 6543)
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 3 : 10,
    // الاتصال يبقى مفتوحاً 5 دقائق بين الطلبات: فتح اتصال جديد يكلف عدة رحلات (TCP و TLS والمصادقة)،
    // والاستخدام متقطع (عميل يكتب نص القالب لدقائق) فكانت المهلة القصيرة تعيد الاتصال مع كل صفحة تقريباً
    idleTimeoutMillis: 5 * 60_000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** عميل Prisma واحد طوال عمر العملية (يمنع فتح اتصالات جديدة مع كل تحديث في وضع التطوير). */
export const db = globalForPrisma.prisma ?? createClient();

globalForPrisma.prisma = db;

import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { buildPlan, uuidv7, type Plan } from "./plan";
import { SenderLinkConflict } from "@/server/client-senders";
import type { FileIssue, ParsedClient } from "./read-clients";
import type { MessageKey } from "@/i18n/translate";

/** المعاينة صالحة للتأكيد خلال هذه المدة؛ بعدها يُرفع الملف من جديد. */
export const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

export type StoredResult = Plan & { fileIssues: FileIssue[] };

export type ApplyOutcome = { ok: true; plan: Plan } | { ok: false; error: MessageKey };

class ApplyRefused extends Error {
  constructor(readonly key: MessageKey) {
    super(key);
  }
}

/**
 * ينفّذ استيراداً معايناً داخل transaction واحدة: إما أن يُضاف كل شيء أو لا شيء.
 * يعيد حساب الخطة داخل المعاملة لأن البيانات قد تتغير منذ المعاينة.
 * لا يحذف ولا يعدّل أي بيانات موجودة: يضيف عملاء جدداً وإيميلات جديدة، ويربط أسماء مرسلين غير مرتبطة فقط.
 */
export async function applyClientImport(importId: string, adminId: string): Promise<ApplyOutcome> {
  try {
    const plan = await db.$transaction(
      async (tx) => {
        const imp = await tx.clientImport.findUnique({
          where: { id: importId },
          select: { status: true, createdAt: true, parsed: true, fileIssues: true },
        });
        if (!imp) throw new ApplyRefused("ci.apply.notFound");
        if (imp.status === "APPLIED") throw new ApplyRefused("ci.apply.done");
        if (imp.status === "CANCELLED") throw new ApplyRefused("ci.apply.cancelled");
        if (Date.now() - imp.createdAt.getTime() > PREVIEW_TTL_MS) {
          throw new ApplyRefused("ci.apply.expired");
        }

        // حجز العملية: يمنع التنفيذ مرتين لو ضُغط الزر مرتين
        const claimed = await tx.clientImport.updateMany({
          where: { id: importId, status: "PREVIEW" },
          data: { status: "APPLIED", finishedAt: new Date() },
        });
        if (claimed.count === 0) throw new ApplyRefused("ci.apply.done");

        const plan = await buildPlan(imp.parsed as unknown as ParsedClient[], tx);

        const newClients: Prisma.ClientCreateManyInput[] = [];
        const newUsers: Prisma.UserCreateManyInput[] = [];
        const links: { id: string; client_id: string }[] = [];
        for (const c of plan.clients) {
          if (c.status === "create") {
            c.clientId = uuidv7();
            c.clientActive = true;
            newClients.push({ id: c.clientId, name: c.name, createdById: adminId });
          }
          if ((c.status === "create" || c.status === "update") && c.clientId) {
            const clientId = c.clientId;
            newUsers.push(...c.addEmails.map((email) => ({ clientId, email })));
            links.push(...c.addSenders.map((s) => ({ id: s.id, client_id: clientId })));
          }
        }

        if (newClients.length) await tx.client.createMany({ data: newClients });
        if (newUsers.length) await tx.user.createMany({ data: newUsers });
        if (links.length) {
          // ربط جماعي باستعلام واحد، ولا يمس مرسلاً ارتبط بعميل آخر في هذه اللحظة
          const linked = await tx.$executeRaw`
            UPDATE "senders" AS s SET "client_id" = v.client_id, "updated_at" = ${new Date()}
            FROM jsonb_to_recordset(${JSON.stringify(links)}::jsonb) AS v(id uuid, client_id uuid)
            WHERE s."id" = v.id AND s."client_id" IS NULL`;
          if (linked !== links.length) throw new SenderLinkConflict();
        }

        const result: StoredResult = { ...plan, fileIssues: imp.fileIssues as unknown as FileIssue[] };
        await tx.clientImport.update({ where: { id: importId }, data: { result: result as unknown as Prisma.InputJsonValue } });
        return plan;
      },
      { timeout: 120_000, maxWait: 15_000 },
    );
    return { ok: true, plan };
  } catch (err) {
    if (err instanceof ApplyRefused) return { ok: false, error: err.key };
    if ((err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") || err instanceof SenderLinkConflict) {
      return { ok: false, error: "ci.apply.race" };
    }
    throw err;
  }
}

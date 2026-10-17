import "server-only";
import type { T } from "@/i18n/translate";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { senderNameKey } from "@/lib/validation";

/**
 * قاعدة الملكية الوحيدة في النظام:
 * المرسل يتبع العميل الذي ربطه به الأدمن (senders.client_id)، يدوياً أو من ملف العملاء.
 * المرسل الواحد لعميل واحد فقط. ويظهر للعميل فقط إذا كان مفعّلاً ولم يغب عن آخر ملف إكسل.
 */

type Db = PrismaClient | Prisma.TransactionClient;

const availableSenderSelect = {
  id: true,
  name: true,
  clientName: true,
  customerType: true,
  senderTypes: true,
  senderExpiryDate: true,
} satisfies Prisma.SenderSelect;

const visibleToClient = { isActive: true, missingFromFile: false } satisfies Prisma.SenderWhereInput;

/** المرسلون الذين يستطيع العميل اختيارهم. */
export async function availableSendersForClient(clientId: string) {
  return db.sender.findMany({
    where: { clientId, ...visibleToClient },
    orderBy: { nameKey: "asc" },
    select: availableSenderSelect,
  });
}

/** يتحقق في الخادم أن المرسل المختار يتبع هذا العميل فعلاً (لا نثق بما يرسله المتصفح). */
export async function findClientSender(clientId: string, senderId: string) {
  return db.sender.findFirst({
    where: { id: senderId, clientId, ...visibleToClient },
    select: availableSenderSelect,
  });
}

/** للأدمن: كل المرسلين المرتبطين بالعميل، مع المعطّلين (ليرى ما يظهر للعميل وما لا يظهر). */
export async function linkedSendersForAdmin(clientId: string) {
  return db.sender.findMany({
    where: { clientId },
    orderBy: { nameKey: "asc" },
    select: { ...availableSenderSelect, isActive: true, missingFromFile: true, requestId: true },
  });
}

type SenderLookup = {
  id: string;
  name: string;
  nameKey: string;
  clientId: string | null;
  isActive: boolean;
  missingFromFile: boolean;
  client: { name: string } | null;
};

/** يبحث عن أسماء المرسلين بمفتاحها (بدون حساسية لحالة الأحرف). */
export async function lookupSenders(names: string[], tx: Db = db): Promise<Map<string, SenderLookup>> {
  const keys = [...new Set(names.map(senderNameKey).filter(Boolean))];
  if (!keys.length) return new Map();
  const rows = await tx.sender.findMany({
    where: { nameKey: { in: keys } },
    select: { id: true, name: true, nameKey: true, clientId: true, isActive: true, missingFromFile: true, client: { select: { name: true } } },
  });
  return new Map(rows.map((r) => [r.nameKey, r]));
}

/**
 * يقرر مصير كل اسم عند ربطه بعميل:
 * غير موجود، مرتبط بعميل آخر، مرتبط بنفس العميل مسبقاً، أو جاهز للربط.
 */
export async function checkSendersForClient(names: string[], clientId: string | null, tx: Db = db) {
  const found = await lookupSenders(names, tx);
  const missing: string[] = [];
  const taken: { name: string; clientName: string }[] = [];
  const already: string[] = [];
  const link: SenderLookup[] = [];
  for (const n of names) {
    const s = found.get(senderNameKey(n));
    if (!s) missing.push(n);
    else if (s.clientId && s.clientId === clientId) already.push(s.name);
    else if (s.clientId) taken.push({ name: s.name, clientName: s.client?.name ?? "—" });
    else link.push(s);
  }
  return { missing, taken, already, link };
}

/** رسالة خطأ موحدة لأسماء لا يمكن ربطها. */
export function senderProblemsMessage(r: { missing: string[]; taken: { name: string; clientName: string }[] }, t: T) {
  const parts: string[] = [];
  if (r.missing.length) parts.push(t("senders.err.missing", { list: r.missing }));
  if (r.taken.length) parts.push(t("senders.err.taken", { list: r.taken.map((x) => t("item.withClient", { item: x.name, client: x.clientName })) }));
  return parts.join(" · ");
}

/** خطأ: اسم مرسل رُبط بعميل آخر أثناء التنفيذ. */
export class SenderLinkConflict extends Error {}

/** يربط المرسلين بالعميل، ويرفض إن رُبط أحدهم بعميل آخر في نفس اللحظة. */
export async function linkSenders(tx: Db, clientId: string, senderIds: string[]) {
  if (!senderIds.length) return 0;
  const res = await tx.sender.updateMany({ where: { id: { in: senderIds }, clientId: null }, data: { clientId } });
  if (res.count !== senderIds.length) throw new SenderLinkConflict();
  return res.count;
}

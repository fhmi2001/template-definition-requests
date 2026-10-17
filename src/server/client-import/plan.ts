import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { lookupSenders } from "@/server/client-senders";
import { senderNameKey } from "@/lib/validation";
import { COLUMN_LABEL, clientKey, type FileIssue, type ParsedClient } from "./read-clients";
import { encodeMsg } from "@/i18n/translate";

type Db = PrismaClient | Prisma.TransactionClient;

export type PlanStatus = "create" | "update" | "unchanged" | "rejected";

export type PlanClient = {
  name: string;
  rows: number[];
  status: PlanStatus;
  clientId: string | null; // العميل الموجود، أو الجديد بعد التنفيذ
  clientActive: boolean | null;
  addEmails: string[];
  keptEmails: string[]; // في الملف ومسجّلة لنفس العميل مسبقاً
  addSenders: { id: string; name: string }[];
  keptSenders: string[]; // في الملف ومرتبطة بنفس العميل مسبقاً
  visibleSenders: number; // أسماء المرسلين التي ستظهر للعميل بعد الاستيراد
};

export type PlanTotals = {
  create: number;
  update: number;
  unchanged: number;
  rejected: number;
  emails: number;
  senders: number;
};

export type Plan = { clients: PlanClient[]; problems: FileIssue[]; totals: PlanTotals };

const firstRow = (c: ParsedClient) => c.rows[0] ?? 0;

/**
 * يقارن ما في الملف بقاعدة البيانات الحالية. لا يكتب شيئاً.
 * يُستدعى للمعاينة، ثم مرة أخرى داخل معاملة التنفيذ (لأن البيانات قد تتغير بينهما).
 */
export async function buildPlan(parsed: ParsedClient[], tx: Db = db): Promise<Plan> {
  const emails = [...new Set(parsed.flatMap((c) => c.emails.map((e) => e.value)))];
  const senderNames = parsed.flatMap((c) => c.senders.map((s) => s.value));

  const [clients, users, senders] = await Promise.all([
    tx.client.findMany({ select: { id: true, name: true, isActive: true } }),
    emails.length
      ? tx.user.findMany({ where: { email: { in: emails } }, select: { email: true, clientId: true, client: { select: { name: true } } } })
      : [],
    lookupSenders(senderNames, tx),
  ]);

  const clientsByKey = new Map<string, { id: string; name: string; isActive: boolean }[]>();
  for (const c of clients) {
    const k = clientKey(c.name);
    clientsByKey.set(k, [...(clientsByKey.get(k) ?? []), c]);
  }
  const userByEmail = new Map(users.map((u) => [u.email, u]));

  const problems: FileIssue[] = [];
  const out: PlanClient[] = [];
  const addedVisible = new Map<PlanClient, number>();

  for (const pc of parsed) {
    const matches = clientsByKey.get(pc.key) ?? [];
    const plan: PlanClient = {
      name: pc.name,
      rows: pc.rows,
      status: "unchanged",
      clientId: null,
      clientActive: null,
      addEmails: [],
      keptEmails: [],
      addSenders: [],
      keptSenders: [],
      visibleSenders: 0,
    };

    if (matches.length > 1) {
      plan.status = "rejected";
      problems.push({
        row: firstRow(pc),
        column: COLUMN_LABEL.name,
        severity: "ERROR",
        message: encodeMsg("ci.issue.ambiguous"),
        value: pc.name,
      });
      out.push(plan);
      continue;
    }
    const target = matches[0] ?? null;
    plan.clientId = target?.id ?? null;
    plan.clientActive = target?.isActive ?? null;

    for (const e of pc.emails) {
      const owner = userByEmail.get(e.value);
      if (!owner) plan.addEmails.push(e.value);
      else if (target && owner.clientId === target.id) plan.keptEmails.push(e.value);
      else {
        problems.push({ row: e.row, column: COLUMN_LABEL.email, severity: "ERROR", message: encodeMsg("ci.issue.emailOwned", { client: owner.client.name }), value: e.value });
      }
    }

    let visibleAdds = 0;
    for (const item of pc.senders) {
      const s = senders.get(senderNameKey(item.value));
      if (!s) {
        problems.push({
          row: item.row,
          column: COLUMN_LABEL.sender,
          severity: "ERROR",
          message: encodeMsg("ci.issue.senderMissing"),
          value: item.value,
        });
      } else if (target && s.clientId === target.id) {
        plan.keptSenders.push(s.name);
      } else if (s.clientId) {
        problems.push({
          row: item.row,
          column: COLUMN_LABEL.sender,
          severity: "ERROR",
          message: encodeMsg("ci.issue.senderOwned", { client: s.client?.name ?? "—" }),
          value: s.name,
        });
      } else {
        plan.addSenders.push({ id: s.id, name: s.name });
        if (s.isActive && !s.missingFromFile) visibleAdds++;
        else {
          problems.push({
            row: item.row,
            column: COLUMN_LABEL.sender,
            severity: "WARNING",
            message: encodeMsg(s.missingFromFile ? "ci.issue.senderAbsent" : "ci.issue.senderDisabled"),
            value: s.name,
          });
        }
      }
    }

    const adds = plan.addEmails.length + plan.addSenders.length;
    if (!target) {
      if (plan.addEmails.length) plan.status = "create";
      else {
        plan.status = "rejected";
        plan.addSenders = [];
        problems.push({
          row: firstRow(pc),
          column: COLUMN_LABEL.email,
          severity: "ERROR",
          message: encodeMsg("ci.issue.newNoEmail"),
          value: pc.name,
        });
      }
    } else if (adds > 0) {
      plan.status = "update";
    }
    if (target && !target.isActive && adds > 0) {
      problems.push({
        row: firstRow(pc),
        column: COLUMN_LABEL.name,
        severity: "WARNING",
        message: encodeMsg("ci.issue.clientDisabled"),
        value: pc.name,
      });
    }
    addedVisible.set(plan, plan.status === "rejected" ? 0 : visibleAdds);
    out.push(plan);
  }

  // ما سيراه كل عميل: المرتبط به الآن (ويظهر) + ما سيُربط من الملف (ويظهر)
  const existingIds = out.filter((p) => p.clientId && p.status !== "rejected").map((p) => p.clientId as string);
  const current = existingIds.length
    ? await tx.sender.groupBy({
        by: ["clientId"],
        where: { clientId: { in: existingIds }, isActive: true, missingFromFile: false },
        _count: { _all: true },
      })
    : [];
  const currentByClient = new Map(current.map((c) => [c.clientId, c._count._all]));
  for (const p of out) {
    if (p.status === "rejected") continue;
    p.visibleSenders = (p.clientId ? (currentByClient.get(p.clientId) ?? 0) : 0) + (addedVisible.get(p) ?? 0);
  }

  const totals: PlanTotals = { create: 0, update: 0, unchanged: 0, rejected: 0, emails: 0, senders: 0 };
  for (const c of out) {
    totals[c.status]++;
    if (c.status === "create" || c.status === "update") {
      totals.emails += c.addEmails.length;
      totals.senders += c.addSenders.length;
    }
  }
  problems.sort((a, b) => a.row - b.row);
  return { clients: out, problems, totals };
}

/** UUID v7 (مرتب زمنياً، مثل افتراضي الجداول) لإنشاء العملاء دفعة واحدة. */
export function uuidv7() {
  const b = randomBytes(16);
  let ts = Date.now();
  for (let i = 5; i >= 0; i--) {
    b[i] = ts & 0xff;
    ts = Math.floor(ts / 256);
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

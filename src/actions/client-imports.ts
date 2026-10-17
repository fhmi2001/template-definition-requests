"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/http-meta";
import { ClientFileError, readClientsFile } from "@/server/client-import/read-clients";
import { applyClientImport } from "@/server/client-import/apply";
import type { ActionState } from "@/lib/action-state";
import { MAX_CLIENT_FILE_BYTES } from "@/lib/import-limits";
import { uuidSchema } from "@/lib/validation";
import { getT } from "@/i18n/server";

const BASE = "/admin/clients/import";

/** رفع ملف العملاء: يُقرأ ويُحفظ كمعاينة فقط، ثم ننتقل لصفحة المعاينة. */
export async function uploadClientsFileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("upload.chooseFile") };
  if (!/\.xlsx$/i.test(file.name)) return { error: t("upload.xlsxOnly") };
  if (file.size > MAX_CLIENT_FILE_BYTES) return { error: t("upload.tooBig", { mb: 5 }) };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return { error: t("upload.notExcel") };
  }

  let parsed;
  try {
    parsed = await readClientsFile(buffer);
  } catch (err) {
    if (err instanceof ClientFileError) return { error: t(err.key, err.params) };
    console.error("[client-import] تعذّرت قراءة الملف", err);
    return { error: t("upload.unreadable") };
  }

  const imp = await db.clientImport.create({
    data: {
      fileName: file.name.replace(/[\\/]/g, "_").slice(0, 255),
      fileSha256: createHash("sha256").update(buffer).digest("hex"),
      sheetName: parsed.sheetName,
      totalRows: parsed.totalRows,
      parsed: parsed.clients as unknown as Prisma.InputJsonValue,
      fileIssues: parsed.issues as unknown as Prisma.InputJsonValue,
      uploadedById: admin.id,
    },
    select: { id: true },
  });
  await audit({
    adminId: admin.id,
    action: "client_import.preview",
    entityType: "client_import",
    entityId: imp.id,
    metadata: { fileName: file.name.slice(0, 255), rows: parsed.totalRows, clients: parsed.clients.length },
    ip: (await requestMeta()).ip,
  });
  redirect(`${BASE}/${imp.id}`);
}

/** تأكيد الاستيراد بعد المعاينة. */
export async function applyClientImportAction(importId: string, _prev: ActionState): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();
  const id = uuidSchema.safeParse(importId);
  if (!id.success) return { error: t("v.invalidIdDot") };

  const outcome = await applyClientImport(id.data, admin.id);
  if (!outcome.ok) return { error: t(outcome.error) };

  await audit({
    adminId: admin.id,
    action: "client_import.apply",
    entityType: "client_import",
    entityId: id.data,
    metadata: { ...outcome.plan.totals, problems: outcome.plan.problems.length },
    ip: (await requestMeta()).ip,
  });
  revalidatePath("/admin/clients");
  revalidatePath(`${BASE}/${id.data}`);
  redirect(`${BASE}/${id.data}`);
}

/** إلغاء المعاينة دون تنفيذ. */
export async function cancelClientImportAction(importId: string) {
  const { admin } = await requireAdmin();
  const id = uuidSchema.safeParse(importId);
  if (!id.success) redirect(BASE);

  const res = await db.clientImport.updateMany({
    where: { id: id.data, status: "PREVIEW" },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  if (res.count) {
    await audit({ adminId: admin.id, action: "client_import.cancel", entityType: "client_import", entityId: id.data });
  }
  redirect(BASE);
}

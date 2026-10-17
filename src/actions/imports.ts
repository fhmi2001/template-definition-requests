"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/dal";
import { requestMeta } from "@/server/http-meta";
import { runImport } from "@/server/import/run-import";
import type { ActionState } from "@/lib/action-state";
import { MAX_IMPORT_BYTES } from "@/lib/import-limits";
import { getT } from "@/i18n/server";
import { encodeMsg } from "@/i18n/translate";

const STALE_MS = 15 * 60 * 1000;

/** رفع ملف الإكسل: تحقق سريع ثم تبدأ المعالجة في الخلفية وتنتقل لصفحة التقرير. */
export async function startImportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { admin } = await requireAdmin();
  const { t } = await getT();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("upload.chooseFile") };
  if (!/\.xlsx$/i.test(file.name)) return { error: t("upload.xlsxOnly") };
  if (file.size > MAX_IMPORT_BYTES) return { error: t("upload.tooBig", { mb: 10 }) };

  const buffer = Buffer.from(await file.arrayBuffer());
  // ملفات xlsx هي أرشيف zip تبدأ بالحرفين PK
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return { error: t("upload.notExcel") };
  }

  // عملية علقت سابقاً (توقف الخادم مثلاً) تُعتبر فاشلة
  await db.importBatch.updateMany({
    where: { status: { in: ["PENDING", "PROCESSING"] }, startedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "FAILED", errorMessage: encodeMsg("ir.stale"), finishedAt: new Date() },
  });
  const running = await db.importBatch.findFirst({ where: { status: { in: ["PENDING", "PROCESSING"] } }, select: { id: true } });
  if (running) return { error: t("ir.running") };

  const batch = await db.importBatch.create({
    data: {
      fileName: file.name.replace(/[\\/]/g, "_").slice(0, 255),
      fileSize: file.size,
      fileSha256: createHash("sha256").update(buffer).digest("hex"),
      status: "PROCESSING",
      uploadedById: admin.id,
    },
  });
  await audit({
    adminId: admin.id,
    action: "import.start",
    entityType: "import",
    entityId: batch.id,
    metadata: { fileName: batch.fileName, fileSize: batch.fileSize },
    ip: (await requestMeta()).ip,
  });

  // المعالجة تكمل بعد إرسال الرد، وصفحة التقرير تتحدث تلقائياً حتى تنتهي
  after(() => runImport(batch.id, buffer, admin.id));
  redirect(`/admin/imports/${batch.id}`);
}

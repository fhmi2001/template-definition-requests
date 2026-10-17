import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { isoDate } from "./normalize";
import { ImportFileError, readReport, type Issue, type SenderRecord } from "./read-report";
import { encodeMsg } from "@/i18n/translate";

/** إن غاب عن الملف عدد كبير من المرسلين فالأرجح أن الملف ناقص، فلا نعطّلهم تلقائياً. */
const MISSING_GUARD_MIN = 25;
const MISSING_GUARD_RATIO = 0.3;
const CHUNK = 500;

const chunks = <T,>(list: T[], size = CHUNK) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

class LockBusyError extends Error {}

const time = (d: Date | null) => (d ? d.getTime() : -Infinity);

/** هل الطلب القادم من الملف أقدم من المحفوظ؟ (نفس ترتيب اختيار "آخر طلب" عند إلغاء المكرر) */
function isOlderThanStored(
  rec: SenderRecord,
  stored: { requestId: string | null; requestDate: Date | null; senderExpiryDate: Date | null },
) {
  if (time(rec.requestDate) !== time(stored.requestDate)) return time(rec.requestDate) < time(stored.requestDate);
  if (time(rec.senderExpiryDate) !== time(stored.senderExpiryDate)) return time(rec.senderExpiryDate) < time(stored.senderExpiryDate);
  return rec.requestId < (stored.requestId ?? "");
}

function senderData(rec: SenderRecord) {
  return {
    requestId: rec.requestId,
    requestStatus: rec.requestStatus,
    requestDate: rec.requestDate,
    expiryDate: rec.expiryDate,
    senderExpiryDate: rec.senderExpiryDate,
    senderTypes: rec.senderTypes,
    clientName: rec.clientName,
    customerType: rec.customerType,
    enterpriseUnifiedNumber: rec.enterpriseUnifiedNumber,
    crNumber: rec.crNumber,
    representativeName: rec.representativeName,
    representativeEmail: rec.representativeEmail,
    representativeMobile: rec.representativeMobile,
    rowHash: rec.rowHash,
  };
}

/**
 * يقرأ الملف ويحدّث جدول المرسلين داخل transaction واحدة:
 * إما أن تُطبّق كل التغييرات أو لا يتغير شيء.
 */
export async function runImport(batchId: string, buffer: Buffer, adminId: string) {
  const startedAt = Date.now();
  try {
    const report = await readReport(buffer);
    const issues: Issue[] = [...report.issues];

    const counts = await db.$transaction(
      async (tx) => {
        // عملية استيراد واحدة فقط في نفس الوقت
        const [lock] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('tdr:excel-import')) AS ok`;
        if (!lock?.ok) throw new LockBusyError();

        const now = new Date();
        const existing = await tx.sender.findMany({
          select: {
            id: true,
            nameKey: true,
            requestId: true,
            rowHash: true,
            missingFromFile: true,
            requestDate: true,
            senderExpiryDate: true,
          },
        });
        const byKey = new Map(existing.map((s) => [s.nameKey, s]));

        const toCreate: SenderRecord[] = [];
        const toUpdate: { id: string; rec: SenderRecord }[] = [];
        const unchangedIds: string[] = [];
        let restored = 0;
        let olderSkipped = 0;

        for (const rec of report.picked) {
          const current = byKey.get(rec.nameKey);
          if (!current) {
            toCreate.push(rec);
            continue;
          }
          if (current.missingFromFile) restored++;
          if (current.rowHash === rec.rowHash) {
            unchangedIds.push(current.id);
          } else if (current.requestId && isOlderThanStored(rec, current)) {
            // ملف قديم أو ناقص: لا نستبدل طلباً أحدث محفوظاً بطلب أقدم
            unchangedIds.push(current.id);
            olderSkipped++;
            issues.push({
              rowNumber: rec.rowNumber,
              requestId: rec.requestId,
              column: null,
              severity: "WARNING",
              message: encodeMsg("ir.olderRequest", { requestId: current.requestId ?? "—" }),
              rawValue: rec.senderName,
            });
          } else {
            toUpdate.push({ id: current.id, rec });
          }
        }

        // رقم طلب انتقل من مرسل لآخر (نادر): نحرّره أولاً حتى لا يتعارض مع القيد الفريد
        const targetByRequest = new Map(report.picked.map((p) => [p.requestId, p.nameKey]));
        const conflicting = existing
          .filter((s) => s.requestId && targetByRequest.has(s.requestId) && targetByRequest.get(s.requestId) !== s.nameKey)
          .map((s) => s.id);
        if (conflicting.length) {
          await tx.sender.updateMany({ where: { id: { in: conflicting } }, data: { requestId: null } });
        }

        // مرسلون جدد
        for (const part of chunks(toCreate)) {
          await tx.sender.createMany({
            data: part.map((rec) => ({
              name: rec.senderName,
              nameKey: rec.nameKey,
              source: "EXCEL" as const,
              ...senderData(rec),
              syncedAt: now,
              lastImportId: batchId,
            })),
          });
        }

        // مرسلون تغيّرت بياناتهم: تحديث جماعي باستعلام واحد لكل دفعة
        for (const part of chunks(toUpdate)) {
          const rows = part.map(({ id, rec }) => ({
            id,
            request_id: rec.requestId,
            request_status: rec.requestStatus,
            request_date: isoDate(rec.requestDate),
            expiry_date: isoDate(rec.expiryDate),
            sender_expiry_date: isoDate(rec.senderExpiryDate),
            sender_types: rec.senderTypes,
            client_name: rec.clientName,
            customer_type: rec.customerType,
            enterprise_unified_number: rec.enterpriseUnifiedNumber,
            cr_number: rec.crNumber,
            representative_name: rec.representativeName,
            representative_email: rec.representativeEmail,
            representative_mobile: rec.representativeMobile,
            row_hash: rec.rowHash,
          }));
          await tx.$executeRaw`
            UPDATE "senders" AS s SET
              "request_id" = v.request_id,
              "request_status" = v.request_status,
              "request_date" = v.request_date,
              "expiry_date" = v.expiry_date,
              "sender_expiry_date" = v.sender_expiry_date,
              "sender_types" = COALESCE(v.sender_types, ARRAY[]::text[]),
              "client_name" = v.client_name,
              "customer_type" = v.customer_type,
              "enterprise_unified_number" = v.enterprise_unified_number,
              "cr_number" = v.cr_number,
              "representative_name" = v.representative_name,
              "representative_email" = v.representative_email,
              "representative_mobile" = v.representative_mobile,
              "row_hash" = v.row_hash,
              "missing_from_file" = false,
              "synced_at" = ${now},
              "last_import_id" = ${batchId}::uuid,
              "updated_at" = ${now}
            FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS v(
              id uuid, request_id varchar, request_status varchar, request_date date, expiry_date date,
              sender_expiry_date date, sender_types text[], client_name varchar, customer_type varchar,
              enterprise_unified_number varchar, cr_number varchar, representative_name varchar,
              representative_email varchar, representative_mobile varchar, row_hash char(64)
            )
            WHERE s."id" = v.id`;
        }

        // بدون تغيير: نسجّل فقط أنها ظهرت في هذا الملف
        for (const part of chunks(unchangedIds, 2000)) {
          await tx.sender.updateMany({
            where: { id: { in: part } },
            data: { syncedAt: now, lastImportId: batchId, missingFromFile: false },
          });
        }

        // مرسلون كانوا في ملفات سابقة وغابوا عن هذا الملف (لم يعودوا Paid) ← تعطيل تلقائي
        const presentKeys = new Set(report.picked.map((p) => p.nameKey));
        const linkedActive = existing.filter((s) => s.requestId !== null && !s.missingFromFile);
        const missingIds = linkedActive.filter((s) => !presentKeys.has(s.nameKey)).map((s) => s.id);
        const guardLimit = Math.max(MISSING_GUARD_MIN, Math.floor(linkedActive.length * MISSING_GUARD_RATIO));
        let missingCount = 0;
        let missingSkipped = false;
        if (missingIds.length > 0 && (report.picked.length === 0 || missingIds.length > guardLimit)) {
          missingSkipped = true;
          issues.push({
            rowNumber: 0,
            requestId: null,
            column: null,
            severity: "WARNING",
            message: encodeMsg("ir.missingSkipped", { n: missingIds.length }),
            rawValue: null,
          });
        } else if (missingIds.length > 0) {
          for (const part of chunks(missingIds, 2000)) {
            await tx.sender.updateMany({ where: { id: { in: part } }, data: { missingFromFile: true } });
          }
          missingCount = missingIds.length;
        }

        for (const part of chunks(issues, 1000)) {
          await tx.importIssue.createMany({ data: part.map((i) => ({ ...i, importId: batchId })) });
        }

        return {
          inserted: toCreate.length,
          updated: toUpdate.length,
          unchanged: unchangedIds.length,
          restored,
          missingCount,
          missingSkipped,
          olderSkipped,
        };
      },
      { timeout: 120_000, maxWait: 15_000 },
    );

    const warningCount = report.warningCount + counts.olderSkipped + (counts.missingSkipped ? 1 : 0);
    await db.importBatch.update({
      where: { id: batchId },
      data: {
        status: report.failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        sheetName: report.sheetName,
        totalRows: report.totalRows,
        paidRows: report.paidRows,
        duplicateCount: report.duplicateCount,
        insertedCount: counts.inserted,
        updatedCount: counts.updated,
        unchangedCount: counts.unchanged,
        failedCount: report.failedCount,
        warningCount,
        missingCount: counts.missingCount,
        restoredCount: counts.restored,
        missingSkipped: counts.missingSkipped,
        finishedAt: new Date(),
      },
    });
    await audit({
      adminId,
      action: "import.complete",
      entityType: "import",
      entityId: batchId,
      metadata: { ...counts, totalRows: report.totalRows, paidRows: report.paidRows, ms: Date.now() - startedAt },
    });
  } catch (err) {
    const message =
      err instanceof ImportFileError
        ? err.message
        : err instanceof LockBusyError
          ? encodeMsg("ir.busy")
          : encodeMsg("ir.unexpected");
    if (!(err instanceof ImportFileError) && !(err instanceof LockBusyError)) {
      console.error("[import] فشل الاستيراد", batchId, err);
    }
    await db.importBatch
      .update({ where: { id: batchId }, data: { status: "FAILED", errorMessage: message, finishedAt: new Date() } })
      .catch((e) => console.error("[import] تعذّر تحديث حالة العملية", e));
    await audit({ adminId, action: "import.failed", entityType: "import", entityId: batchId, metadata: { message } });
  }
}

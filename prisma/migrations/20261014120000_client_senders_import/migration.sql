-- =============================================================================
-- 1) إلغاء الربط بالسجل التجاري والرقم الموحد
-- =============================================================================

-- DropTable
DROP TABLE "client_identifiers";

-- DropEnum
DROP TYPE "IdentifierType";

-- DropIndex
DROP INDEX "senders_cr_number_idx";

-- DropIndex
DROP INDEX "senders_enterprise_unified_number_idx";

-- =============================================================================
-- 2) ربط اسم المرسل بعميل واحد مباشرة
-- =============================================================================

-- AlterTable
ALTER TABLE "senders" ADD COLUMN "client_id" UUID;

-- CreateIndex
CREATE INDEX "senders_client_id_idx" ON "senders"("client_id");

-- AddForeignKey
ALTER TABLE "senders" ADD CONSTRAINT "senders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 3) استيراد العملاء من إكسل (معاينة ثم تأكيد)
-- =============================================================================

-- CreateEnum
CREATE TYPE "ClientImportStatus" AS ENUM ('PREVIEW', 'APPLIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "client_imports" (
    "id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_sha256" CHAR(64) NOT NULL,
    "sheet_name" VARCHAR(100),
    "status" "ClientImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "total_rows" INTEGER NOT NULL,
    "parsed" JSONB NOT NULL,
    "file_issues" JSONB NOT NULL,
    "result" JSONB,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "client_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_imports_created_at_idx" ON "client_imports"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "client_imports" ADD CONSTRAINT "client_imports_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- إضافة يدوية (لا يديرها Prisma): إغلاق الجدول الجديد أمام Data API
-- =============================================================================
ALTER TABLE "client_imports" ENABLE ROW LEVEL SECURITY;

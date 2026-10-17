-- =============================================================================
-- استيراد صفوف Paid فقط، وسجل واحد لكل مرسل يحمل بيانات آخر طلب له.
-- جداول الطلبات والمشغلين لم تعد مطلوبة (كانت فارغة عند هذا التغيير).
-- =============================================================================

-- DropTable
DROP TABLE "operator_activations";

-- DropTable
DROP TABLE "operators";

-- DropTable
DROP TABLE "contract_requests";

-- DropEnum
DROP TYPE "RequestKind";

-- AlterTable
ALTER TABLE "import_batches" DROP COLUMN "senders_created",
ADD COLUMN     "duplicate_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "missing_skipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paid_rows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "restored_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "senders" ADD COLUMN     "client_name" VARCHAR(255),
ADD COLUMN     "cr_number" VARCHAR(40),
ADD COLUMN     "customer_type" VARCHAR(30),
ADD COLUMN     "enterprise_unified_number" VARCHAR(40),
ADD COLUMN     "expiry_date" DATE,
ADD COLUMN     "last_import_id" UUID,
ADD COLUMN     "missing_from_file" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "representative_email" VARCHAR(254),
ADD COLUMN     "representative_mobile" VARCHAR(20),
ADD COLUMN     "representative_name" VARCHAR(150),
ADD COLUMN     "request_date" DATE,
ADD COLUMN     "request_id" VARCHAR(40),
ADD COLUMN     "request_status" VARCHAR(30),
ADD COLUMN     "row_hash" CHAR(64),
ADD COLUMN     "sender_expiry_date" DATE,
ADD COLUMN     "sender_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "synced_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "senders_request_id_key" ON "senders"("request_id");

-- CreateIndex
CREATE INDEX "senders_sender_expiry_date_idx" ON "senders"("sender_expiry_date");

-- CreateIndex
CREATE INDEX "senders_last_import_id_idx" ON "senders"("last_import_id");

-- AddForeignKey
ALTER TABLE "senders" ADD CONSTRAINT "senders_last_import_id_fkey" FOREIGN KEY ("last_import_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

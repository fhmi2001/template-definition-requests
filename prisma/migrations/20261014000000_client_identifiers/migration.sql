-- =============================================================================
-- أرقام الجهة لكل عميل (السجل التجاري والرقم الموحد): يرى العميل مرسليه فقط.
-- =============================================================================

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('CR', 'UNIFIED');

-- CreateTable
CREATE TABLE "client_identifiers" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_identifiers_client_id_idx" ON "client_identifiers"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_identifiers_type_value_key" ON "client_identifiers"("type", "value");

-- CreateIndex
CREATE INDEX "senders_cr_number_idx" ON "senders"("cr_number");

-- CreateIndex
CREATE INDEX "senders_enterprise_unified_number_idx" ON "senders"("enterprise_unified_number");

-- AddForeignKey
ALTER TABLE "client_identifiers" ADD CONSTRAINT "client_identifiers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- إضافة يدوية (لا يديرها Prisma): إغلاق الجدول الجديد أمام Data API
-- =============================================================================
ALTER TABLE "client_identifiers" ENABLE ROW LEVEL SECURITY;

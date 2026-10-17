-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('PLEDGE');

-- AlterTable
ALTER TABLE "template_requests" ADD COLUMN     "content" VARCHAR(1000),
ADD COLUMN     "customer_type" VARCHAR(30),
ADD COLUMN     "exceptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reference_no" INTEGER,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "variables" JSONB;

-- CreateTable
CREATE TABLE "request_attachments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_attachments_request_id_kind_idx" ON "request_attachments"("request_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "template_requests_reference_no_key" ON "template_requests"("reference_no");

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "template_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- إضافات يدوية (لا يديرها Prisma)
-- =============================================================================
-- أرقام الطلبات الظاهرة للعميل (تُعطى عند التقديم فقط)
CREATE SEQUENCE "template_request_ref_seq" START 1;

-- إغلاق الجدول الجديد أمام Data API
ALTER TABLE "request_attachments" ENABLE ROW LEVEL SECURITY;

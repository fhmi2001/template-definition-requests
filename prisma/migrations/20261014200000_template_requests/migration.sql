-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "template_requests" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "sender_id" UUID,
    "sender_name" VARCHAR(11) NOT NULL,
    "sender_type" VARCHAR(40),
    "awareness_client_name" VARCHAR(255),
    "template_name" VARCHAR(100),
    "template_description" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_requests_client_id_status_updated_at_idx" ON "template_requests"("client_id", "status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "template_requests_sender_id_idx" ON "template_requests"("sender_id");

-- CreateIndex
CREATE INDEX "template_requests_user_id_idx" ON "template_requests"("user_id");

-- AddForeignKey
ALTER TABLE "template_requests" ADD CONSTRAINT "template_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_requests" ADD CONSTRAINT "template_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_requests" ADD CONSTRAINT "template_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "senders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- إضافة يدوية (لا يديرها Prisma): إغلاق الجدول الجديد أمام Data API
-- =============================================================================
ALTER TABLE "template_requests" ENABLE ROW LEVEL SECURITY;

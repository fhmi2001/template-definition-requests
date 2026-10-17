-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "template_requests" ADD COLUMN     "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
ADD COLUMN     "rejection_reason" VARCHAR(1000),
ADD COLUMN     "review_status" "ReviewStatus",
ADD COLUMN     "reviewed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "request_status_changes" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "from_status" "ReviewStatus",
    "to_status" "ReviewStatus" NOT NULL,
    "reason" VARCHAR(1000),
    "admin_id" UUID,
    "email_to" VARCHAR(254),
    "email_status" "EmailStatus",
    "email_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_status_changes_request_id_created_at_idx" ON "request_status_changes"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "template_requests_status_review_status_submitted_at_idx" ON "template_requests"("status", "review_status", "submitted_at" DESC);

-- AddForeignKey
ALTER TABLE "request_status_changes" ADD CONSTRAINT "request_status_changes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "template_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_changes" ADD CONSTRAINT "request_status_changes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- إضافات يدوية (لا يديرها Prisma)
-- =============================================================================
-- الطلبات المقدّمة قبل هذا التحديث تصبح «مستلم»، ويُسجَّل استلامها في السجل
UPDATE "template_requests" SET "review_status" = 'RECEIVED' WHERE "status" = 'SUBMITTED' AND "review_status" IS NULL;

INSERT INTO "request_status_changes" ("id", "request_id", "from_status", "to_status", "email_status", "created_at")
SELECT gen_random_uuid(), "id", NULL, 'RECEIVED', 'SKIPPED', COALESCE("submitted_at", CURRENT_TIMESTAMP)
FROM "template_requests" WHERE "status" = 'SUBMITTED';

-- إغلاق الجدول الجديد أمام Data API
ALTER TABLE "request_status_changes" ENABLE ROW LEVEL SECURITY;

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionActor" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SenderSource" AS ENUM ('MANUAL', 'EXCEL');

-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('NEW', 'RENEWAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('ERROR', 'WARNING');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "full_name" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "request_ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(100),
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "actor" "SessionActor" NOT NULL,
    "user_id" UUID,
    "admin_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "senders" (
    "id" UUID NOT NULL,
    "name" VARCHAR(11) NOT NULL,
    "name_key" VARCHAR(11) NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source" "SenderSource" NOT NULL DEFAULT 'MANUAL',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_requests" (
    "id" UUID NOT NULL,
    "request_id" VARCHAR(40) NOT NULL,
    "kind" "RequestKind" NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_name_raw" VARCHAR(11) NOT NULL,
    "sender_types" TEXT[],
    "client_name" VARCHAR(255) NOT NULL,
    "customer_type" VARCHAR(30) NOT NULL,
    "enterprise_unified_number" VARCHAR(40),
    "cr_number" VARCHAR(40),
    "is_favorite_client" BOOLEAN NOT NULL DEFAULT false,
    "representative_name" VARCHAR(150),
    "representative_id" VARCHAR(20),
    "representative_email" VARCHAR(254),
    "representative_mobile" VARCHAR(20),
    "provider_name" VARCHAR(150) NOT NULL,
    "tenant_name" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "request_date" DATE NOT NULL,
    "expiry_date" DATE,
    "sender_expiry_date" DATE,
    "payment_date" DATE,
    "source_modified_at" DATE,
    "rejection_reason" TEXT,
    "number_of_actions" INTEGER NOT NULL DEFAULT 0,
    "source_created_by" VARCHAR(50),
    "row_hash" CHAR(64) NOT NULL,
    "last_import_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_activations" (
    "contract_request_id" UUID NOT NULL,
    "operator_id" INTEGER NOT NULL,
    "activated_at" DATE NOT NULL,

    CONSTRAINT "operator_activations_pkey" PRIMARY KEY ("contract_request_id","operator_id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_sha256" CHAR(64) NOT NULL,
    "sheet_name" VARCHAR(100),
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_by_id" UUID NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "inserted_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "unchanged_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "senders_created" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_issues" (
    "id" BIGSERIAL NOT NULL,
    "import_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "request_id" VARCHAR(40),
    "column" VARCHAR(100),
    "severity" "IssueSeverity" NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "raw_value" VARCHAR(500),

    CONSTRAINT "import_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(64),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "otp_codes_email_created_at_idx" ON "otp_codes"("email", "created_at" DESC);

-- CreateIndex
CREATE INDEX "otp_codes_request_ip_created_at_idx" ON "otp_codes"("request_ip", "created_at");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_admin_id_idx" ON "sessions"("admin_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "senders_name_key_key" ON "senders"("name_key");

-- CreateIndex
CREATE INDEX "senders_is_active_name_idx" ON "senders"("is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "contract_requests_request_id_key" ON "contract_requests"("request_id");

-- CreateIndex
CREATE INDEX "contract_requests_sender_id_request_date_idx" ON "contract_requests"("sender_id", "request_date" DESC);

-- CreateIndex
CREATE INDEX "contract_requests_status_idx" ON "contract_requests"("status");

-- CreateIndex
CREATE INDEX "contract_requests_sender_expiry_date_idx" ON "contract_requests"("sender_expiry_date");

-- CreateIndex
CREATE INDEX "contract_requests_cr_number_idx" ON "contract_requests"("cr_number");

-- CreateIndex
CREATE INDEX "contract_requests_representative_email_idx" ON "contract_requests"("representative_email");

-- CreateIndex
CREATE INDEX "contract_requests_last_import_id_idx" ON "contract_requests"("last_import_id");

-- CreateIndex
CREATE UNIQUE INDEX "operators_name_key" ON "operators"("name");

-- CreateIndex
CREATE INDEX "operator_activations_operator_id_activated_at_idx" ON "operator_activations"("operator_id", "activated_at");

-- CreateIndex
CREATE INDEX "import_batches_started_at_idx" ON "import_batches"("started_at" DESC);

-- CreateIndex
CREATE INDEX "import_batches_file_sha256_idx" ON "import_batches"("file_sha256");

-- CreateIndex
CREATE INDEX "import_issues_import_id_severity_row_number_idx" ON "import_issues"("import_id", "severity", "row_number");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_admin_id_created_at_idx" ON "audit_logs"("admin_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senders" ADD CONSTRAINT "senders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "senders" ADD CONSTRAINT "senders_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_requests" ADD CONSTRAINT "contract_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "senders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_requests" ADD CONSTRAINT "contract_requests_last_import_id_fkey" FOREIGN KEY ("last_import_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_activations" ADD CONSTRAINT "operator_activations_contract_request_id_fkey" FOREIGN KEY ("contract_request_id") REFERENCES "contract_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_activations" ADD CONSTRAINT "operator_activations_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- إضافات يدوية (لا يديرها Prisma)
-- =============================================================================

-- الجلسة تخص مستخدماً أو أدمن، وليس الاثنين
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_actor_check" CHECK (
    ("actor" = 'USER'  AND "user_id"  IS NOT NULL AND "admin_id" IS NULL) OR
    ("actor" = 'ADMIN' AND "admin_id" IS NOT NULL AND "user_id"  IS NULL)
);

-- Supabase يعرض جداول public عبر Data API بمفتاح anon العام.
-- التطبيق يتصل عبر Prisma فقط، لذلك نغلق كل الجداول أمام anon و authenticated.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "otp_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "senders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contract_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operator_activations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- المشغلون المعروفون (الاستيراد يضيف أي مشغل جديد تلقائياً)
INSERT INTO "operators" ("name", "sort_order") VALUES
    ('STC', 1), ('Mobily', 2), ('Zain', 3), ('Salam', 4), ('Lebara', 5), ('Red Bull', 6);

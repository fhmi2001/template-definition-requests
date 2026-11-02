-- =============================================================================
-- Matrix (Deewan backoffice) sync: clients, their accounts, senders and console users
-- are copied from Matrix so a client only signs in and picks from its own sender IDs.
-- =============================================================================

-- AlterEnum
ALTER TYPE "SenderSource" ADD VALUE 'MATRIX';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "matrix_client_id" INTEGER,
ADD COLUMN "account_manager" VARCHAR(150),
ADD COLUMN "matrix_synced_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "senders" ADD COLUMN "matrix_account_id" INTEGER,
ADD COLUMN "matrix_account_sender_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "matrix_user_id" VARCHAR(40),
ADD COLUMN "matrix_account_id" INTEGER,
ADD COLUMN "source" VARCHAR(20);

-- CreateTable
CREATE TABLE "matrix_accounts" (
    "account_id" INTEGER NOT NULL,
    "client_id" UUID NOT NULL,
    "parent_account_id" INTEGER,
    "account_name" VARCHAR(200),
    "username" VARCHAR(200),
    "company_name" VARCHAR(255),
    "email" VARCHAR(254),
    "console_email" VARCHAR(254),
    "product" VARCHAR(100),
    "status" INTEGER,
    "billing_company" VARCHAR(100),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matrix_accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_matrix_client_id_key" ON "clients"("matrix_client_id");
CREATE UNIQUE INDEX "senders_matrix_account_sender_id_key" ON "senders"("matrix_account_sender_id");
CREATE INDEX "senders_matrix_account_id_idx" ON "senders"("matrix_account_id");
CREATE UNIQUE INDEX "users_matrix_user_id_key" ON "users"("matrix_user_id");
CREATE INDEX "matrix_accounts_client_id_idx" ON "matrix_accounts"("client_id");

-- AddForeignKey
ALTER TABLE "matrix_accounts" ADD CONSTRAINT "matrix_accounts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual (not managed by Prisma): keep the new table closed to the Data API, like the others
ALTER TABLE "matrix_accounts" ENABLE ROW LEVEL SECURITY;

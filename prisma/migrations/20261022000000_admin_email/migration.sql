-- بريد لكل حساب إدارة، فريد بين المشرفين. عمود اختياري حتى تُكمل الحسابات القديمة بريدها.
ALTER TABLE "admins" ADD COLUMN "email" VARCHAR(254);

CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

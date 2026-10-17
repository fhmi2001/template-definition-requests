import "dotenv/config";
import { defineConfig } from "prisma/config";

// prisma generate لا يتصل بقاعدة البيانات، فلا نشترط DATABASE_URL أثناء البناء على Netlify.
// أوامر القاعدة (db:deploy وغيرها) تأخذ الرابط الحقيقي من ملف .env.
const PLACEHOLDER_URL = "postgresql://build:build@127.0.0.1:5432/build";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || PLACEHOLDER_URL,
  },
});

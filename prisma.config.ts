import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Client generation does not connect to the database. Database commands
    // still require DATABASE_URL, but installation can run without it.
    url: process.env.DATABASE_URL,
  },
});

// Prisma 7 config: the Migrate CLI reads its connection URL from here.
// The application's PrismaClient does NOT use this file at runtime — it
// connects via an explicit driver adapter, see src/server/db/client.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});

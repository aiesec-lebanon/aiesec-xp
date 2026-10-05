import { defineConfig } from "@prisma/config";

// The Prisma CLI doesn't load .env.local the way Next.js does.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Absent in CI and on Vercel.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Config is seeded by migration so no deploy runs without an active config.
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // The transaction-mode pooler in DATABASE_URL can't run DDL or hold advisory locks.
    url: process.env.DIRECT_URL,
  },
});

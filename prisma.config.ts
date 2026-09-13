import { defineConfig } from "@prisma/config";

// Next.js loads .env.local by itself; the Prisma CLI does not, and reads .env.
// Rather than keep a second copy of the credentials, load the same file the app
// uses. process.loadEnvFile is built into Node, so this needs no dependency.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Absent in CI and on Vercel, where the platform injects the variables.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    // Migrations run over the session-mode pooler. The transaction-mode pooler
    // in DATABASE_URL cannot run DDL or hold advisory locks.
    url: process.env.DIRECT_URL,
  },
});

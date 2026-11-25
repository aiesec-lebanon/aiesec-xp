import { defineConfig } from "@prisma/config";

// Next.js loads .env.local by itself; the Prisma CLI does not, and reads .env.
// Rather than keep a second copy of the credentials, load the same file the app
// uses. process.loadEnvFile is built into Node, so this needs no dependency.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Absent in CI and on Vercel, where the platform injects the variables.
}

// Migrations go over TLS like the app does; a local database has none.
const LOCAL_DB = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/i;
const withTls = (url: string | undefined): string | undefined => {
  if (!url || LOCAL_DB.test(url) || /[?&]sslmode=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Configuration is seeded by migration, not by a seed script, so a deploy
  // cannot reach a running state with no active config.
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations run over the session-mode pooler. The transaction-mode pooler
    // in DATABASE_URL cannot run DDL or hold advisory locks.
    url: withTls(process.env.DIRECT_URL),
  },
});

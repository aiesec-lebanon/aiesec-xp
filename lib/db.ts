import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { PoolConfig } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * node-postgres sends nothing over TLS unless told to. Remote connections are
 * always encrypted; the server certificate is verified once DATABASE_CA_CERT
 * (Supabase dashboard, Database, SSL) is set. An explicit `sslmode` in the URL
 * is the operator's choice and is left to pg.
 */
export function sslOption(connectionString: string): PoolConfig["ssl"] {
  if (/[?&]sslmode=/i.test(connectionString)) return undefined;

  const ca = process.env.DATABASE_CA_CERT?.trim();
  // Env UIs often store a PEM on one line with literal "\n" separators.
  if (ca) return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };

  try {
    if (LOCAL_HOSTS.has(new URL(connectionString).hostname)) return undefined;
  } catch {
    // Not a URL pg can parse either; let it report that.
  }
  return { rejectUnauthorized: false };
}

// Prisma 7 takes its connection from a driver adapter rather than the schema.
// DATABASE_URL is the transaction-mode pooler; migrations use DIRECT_URL and
// are configured separately in prisma.config.ts.
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, ssl: sslOption(connectionString) }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reused across hot reloads in development, where a fresh client per reload
// exhausts the pooler's connection limit within minutes.
const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

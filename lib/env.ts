import "server-only";

import { z } from "zod";

// Grouped rather than one all-or-nothing object. Signing a session cookie needs
// SESSION_SECRET and nothing else, and the proxy does exactly that on every
// request -- validating the GIS and OAuth configuration there would couple route
// protection to credentials it never uses.

const groups = {
  database: z.object({
    DATABASE_URL: z.string().min(1),
  }),
  auth: z.object({
    AIESEC_AUTH_URL: z.url(),
    AIESEC_CLIENT_ID: z.string().min(1),
    AIESEC_CLIENT_SECRET: z.string().min(1),
    AIESEC_REDIRECT_URI: z.url(),
  }),
  gis: z.object({
    GIS_GRAPHQL_URL: z.url(),
    GIS_SERVICE_TOKEN: z.string().min(1),
  }),
  session: z.object({
    SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
  }),
  scope: z.object({
    MC_OFFICE_ID: z.coerce.number().int().positive(),
  }),
} as const;

type Groups = typeof groups;
type GroupName = keyof Groups;

const cache = new Map<GroupName, unknown>();

function read<K extends GroupName>(name: K): z.infer<Groups[K]> {
  const hit = cache.get(name);
  if (hit) return hit as z.infer<Groups[K]>;

  const parsed = groups[name].safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment is not valid:\n${problems}`);
  }

  cache.set(name, parsed.data);
  return parsed.data as z.infer<Groups[K]>;
}

export const databaseEnv = () => read("database");
export const authEnv = () => read("auth");
export const gisEnv = () => read("gis");
export const sessionSecret = () => read("session").SESSION_SECRET;
export const mcOfficeId = () => BigInt(read("scope").MC_OFFICE_ID);

/** Fails fast at boot rather than on the first request that needs a variable. */
export function assertEnv(): void {
  for (const name of Object.keys(groups) as GroupName[]) read(name);
}

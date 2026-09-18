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
    // The GIS office id MC-direct activity is actually recorded under in each
    // system, which is not always MC_OFFICE_ID. A member's own position uses
    // MC_OFFICE_ID (D-32); the AIESEC analytics API buckets MC-direct's
    // applications under this other, sibling entity instead (D-56) -- both
    // represent "MC-direct" but as two different ids in two different GIS
    // subsystems. Optional: unset, MC-direct's office-level funnel counts are
    // read from MC_OFFICE_ID's own analytics key, which the API never
    // populates, so they read zero rather than crashing.
    MC_DIRECT_ENTITY_ID: z.coerce.number().int().positive().optional(),
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

/** null when unset -- see the MC_DIRECT_ENTITY_ID comment above. */
export const mcDirectEntityId = (): bigint | null => {
  const id = read("scope").MC_DIRECT_ENTITY_ID;
  return id === undefined ? null : BigInt(id);
};

/** Fails fast at boot rather than on the first request that needs a variable. */
export function assertEnv(): void {
  for (const name of Object.keys(groups) as GroupName[]) read(name);
}

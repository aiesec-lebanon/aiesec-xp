import { normaliseRole, SHARE_FIELD_PREFIX, validateRoleShares, type RoleShares } from "@/lib/scoring/shares";

// The weights an admin edits on /admin/scoring for the current period (D-85).
// Pure, so parsing and validation are tested directly.

export type Weights = {
  aplPoints: number;
  apdPoints: number;
  rePoints: number;
  productWeights: Record<string, number>;
  directionWeights: Record<string, number>;
  roleShares: RoleShares;
};

export const POINTS_FIELD = { aplPoints: "points:APL", apdPoints: "points:APD", rePoints: "points:RE" } as const;
export const PRODUCT_FIELD_PREFIX = "product:";
export const DIRECTION_FIELD_PREFIX = "direction:";

function number(raw: FormDataEntryValue | null): number {
  if (typeof raw !== "string" || raw.trim() === "") return Number.NaN;
  return Number(raw);
}

/**
 * Reads the form against the current weights. Programmes and directions are
 * only ever the ones already configured: the programmes double as what sync
 * collects (lib/sync/run.ts), and one with no weight scores zero by design
 * (D-30), so neither is something this form adds or removes.
 */
export function readWeightsForm(form: FormData, current: Weights): Weights {
  const roleShares: Record<string, number> = {};
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith(SHARE_FIELD_PREFIX) || typeof raw !== "string") continue;
    roleShares[normaliseRole(key.slice(SHARE_FIELD_PREFIX.length))] = raw.trim() === "" ? 0 : Number(raw);
  }

  return {
    aplPoints: number(form.get(POINTS_FIELD.aplPoints)),
    apdPoints: number(form.get(POINTS_FIELD.apdPoints)),
    rePoints: number(form.get(POINTS_FIELD.rePoints)),
    productWeights: Object.fromEntries(
      Object.keys(current.productWeights).map((id) => [id, number(form.get(`${PRODUCT_FIELD_PREFIX}${id}`))])
    ),
    directionWeights: Object.fromEntries(
      Object.keys(current.directionWeights).map((key) => [key, number(form.get(`${DIRECTION_FIELD_PREFIX}${key}`))])
    ),
    roleShares,
  };
}

function nonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** First problem first, in the order the form shows the fields. */
export function validateWeights(weights: Weights): string[] {
  const problems: string[] = [];
  if (!nonNegative(weights.aplPoints)) problems.push("Application points need to be 0 or more.");
  if (!nonNegative(weights.apdPoints)) problems.push("Approval points need to be 0 or more.");
  if (!nonNegative(weights.rePoints)) problems.push("Realization points need to be 0 or more.");
  for (const [id, value] of Object.entries(weights.productWeights)) {
    if (!nonNegative(value)) problems.push(`The weight for programme ${id} needs to be 0 or more.`);
  }
  for (const [key, value] of Object.entries(weights.directionWeights)) {
    if (!nonNegative(value)) problems.push(`The ${key.toLowerCase()} weight needs to be 0 or more.`);
  }
  problems.push(...validateRoleShares(weights.roleShares).map((problem) => problem.message));
  return problems;
}

function sameRecord(a: Readonly<Record<string, number>>, b: Readonly<Record<string, number>>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

export function sameWeights(a: Weights, b: Weights): boolean {
  return (
    a.aplPoints === b.aplPoints &&
    a.apdPoints === b.apdPoints &&
    a.rePoints === b.rePoints &&
    sameRecord(a.productWeights, b.productWeights) &&
    sameRecord(a.directionWeights, b.directionWeights) &&
    sameRecord(a.roleShares, b.roleShares)
  );
}

// How much of an EP's points and counts each member credited with it takes
// (D-83). Pure, so the rules are tested directly (tests/scoring-shares.test.ts).

/** Percentage of an event per position role, e.g. { TM: 40, MCP: 10 }. */
export type RoleShares = Readonly<Record<string, number>>;

export type Creditee = { memberId: bigint; role: string | null };

export function normaliseRole(role: string | null | undefined): string {
  return (role ?? "").trim().toUpperCase();
}

/** A role's percentage as a fraction; a role with none set takes nothing. */
export function roleFraction(shares: RoleShares, role: string | null): number {
  const value = shares[normaliseRole(role)];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 100) / 100;
}

/**
 * Each member's fraction of every event on an EP, keyed by member id.
 *
 * The main manager an admin picked takes all of it; everyone else takes their
 * role's percentage, each in full however many share the role, so an EP can pay
 * out more than its points. With no pick, a manager alone on the EP takes all
 * of it and several take their role's percentage each.
 *
 * `mainMemberId` is the pick whether or not that person can still be credited:
 * a main who is no longer a member earns nothing, and nobody is promoted in
 * their place, not even a manager left alone on the EP.
 */
export function creditShares(
  creditees: readonly Creditee[],
  mainMemberId: bigint | null,
  shares: RoleShares
): Map<string, number> {
  const roleByMember = new Map<string, string | null>();
  for (const creditee of creditees) {
    const key = String(creditee.memberId);
    if (!roleByMember.has(key)) roleByMember.set(key, creditee.role);
  }

  const main = mainMemberId === null ? null : String(mainMemberId);
  const result = new Map<string, number>();

  for (const [member, role] of roleByMember) {
    const full = main === null ? roleByMember.size === 1 : member === main;
    result.set(member, full ? 1 : roleFraction(shares, role));
  }

  return result;
}

export type RoleSharesProblem = { role: string | null; message: string };

/** What an admin may save: a percentage from 0 to 100 per role. */
export function validateRoleShares(shares: RoleShares): RoleSharesProblem[] {
  const problems: RoleSharesProblem[] = [];

  for (const [role, value] of Object.entries(shares)) {
    if (normaliseRole(role) === "") {
      problems.push({ role, message: "A role needs a name." });
    } else if (!Number.isFinite(value) || value < 0 || value > 100) {
      problems.push({ role, message: `${role} needs a percentage from 0 to 100.` });
    }
  }

  return problems;
}

export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Each role's input on the admin form is named `share:<ROLE>`, so it can list any role EXPA uses. */
export const SHARE_FIELD_PREFIX = "share:";

// How one EP's points are divided between the members credited with it (D-73).
// Pure, so the rules are tested directly (tests/scoring-shares.test.ts).

/** Percentage per position role, e.g. { TM: 40, TL: 30, LCVP: 30 }. */
export type RoleShares = Readonly<Record<string, number>>;

export type Creditee = { memberId: bigint; role: string | null };

export function normaliseRole(role: string | null | undefined): string {
  return (role ?? "").trim().toUpperCase();
}

function weightOf(shares: RoleShares, role: string): number {
  const value = shares[role];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Each member's fraction of an EP's points, keyed by member id.
 *
 * A member alone on an EP takes all of it, whatever their role. Otherwise each
 * role on the EP takes its configured share, rescaled over the roles actually
 * present so the EP's points are always paid out in full, and members holding
 * the same role split that role's part evenly. A role with no share gets
 * nothing beside someone who has one; when nobody present has a share, they
 * split evenly rather than the points vanishing.
 */
export function splitShares(creditees: readonly Creditee[], shares: RoleShares): Map<string, number> {
  const roleByMember = new Map<string, string>();
  for (const creditee of creditees) {
    const key = String(creditee.memberId);
    if (!roleByMember.has(key)) roleByMember.set(key, normaliseRole(creditee.role));
  }

  const result = new Map<string, number>();
  if (roleByMember.size === 0) return result;

  const membersByRole = new Map<string, string[]>();
  for (const [member, role] of roleByMember) {
    const bucket = membersByRole.get(role);
    if (bucket) bucket.push(member);
    else membersByRole.set(role, [member]);
  }

  const total = [...membersByRole.keys()].reduce((sum, role) => sum + weightOf(shares, role), 0);

  for (const [role, members] of membersByRole) {
    const roleFraction = total > 0 ? weightOf(shares, role) / total : members.length / roleByMember.size;
    for (const member of members) result.set(member, roleFraction / members.length);
  }

  return result;
}

export type RoleSharesProblem = { role: string | null; message: string };

/**
 * What an admin may save: a percentage from 0 to 100 per role, totalling 100.
 * The total is required even though the split rescales, because a share only
 * reads as "this role's percentage" when all of them together make 100.
 */
export function validateRoleShares(shares: RoleShares): RoleSharesProblem[] {
  const problems: RoleSharesProblem[] = [];
  let total = 0;

  for (const [role, value] of Object.entries(shares)) {
    if (normaliseRole(role) === "") {
      problems.push({ role, message: "A role needs a name." });
    } else if (!Number.isFinite(value) || value < 0 || value > 100) {
      problems.push({ role, message: `${role} must be between 0 and 100.` });
    } else {
      total += value;
    }
  }

  if (problems.length === 0 && Math.abs(total - 100) > 0.001) {
    problems.push({ role: null, message: `The shares add up to ${roundPercent(total)}%, not 100%.` });
  }

  return problems;
}

export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Each role's input on the admin form is named `share:<ROLE>`, so it can list any role EXPA uses. */
export const SHARE_FIELD_PREFIX = "share:";

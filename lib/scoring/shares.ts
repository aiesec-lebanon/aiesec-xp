// Percentage per position role, e.g. { TM: 40, MCP: 10 }.
export type RoleShares = Readonly<Record<string, number>>;

export type Creditee = { memberId: bigint; role: string | null };

export function normaliseRole(role: string | null | undefined): string {
  return (role ?? "").trim().toUpperCase();
}

export function roleFraction(shares: RoleShares, role: string | null): number {
  const value = shares[normaliseRole(role)];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 100) / 100;
}

// Non-main roles each take their full percentage, so an EP can pay out more than its points.
// A main who is no longer creditable earns nothing and nobody is promoted in their place.
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

export const SHARE_FIELD_PREFIX = "share:";

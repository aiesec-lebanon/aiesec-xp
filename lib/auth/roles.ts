import type { MatcherField } from "@prisma/client";

// Pure role resolution: no I/O, so it can be unit-tested exhaustively. The
// caller supplies the positions, the matcher list and the operating offices.

export type Role = "ADMIN" | "LEAD" | "MEMBER" | "DENIED";

export type PositionInput = {
  officeId: bigint;
  roleName: string | null;
  title: string | null;
  status: string | null;
};

export type Matcher = {
  field: MatcherField;
  pattern: string;
};

/** GIS reports an in-force position as "active"; "current" is not a status value. */
const ACTIVE_STATUS = "active";

// LEAD is the LC officer tier: assign EPs within their own LC (Architecture 4.2).
const LEAD_ROLE_NAMES = new Set(["LCP", "LCVP", "TL"]);

// Ranked most senior first. Used to pick one scoring office for a member who
// holds several positions, so their points land in exactly one LC total (D-32).
const ROLE_SENIORITY = ["MCP", "MCVP", "LCP", "LCVP", "TL", "ESTL", "ESTM", "TM"];

function isActive(position: PositionInput): boolean {
  return position.status?.toLowerCase() === ACTIVE_STATUS;
}

function normalise(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function matches(position: PositionInput, matcher: Matcher): boolean {
  const candidate = matcher.field === "ROLE_NAME" ? position.roleName : position.title;
  return normalise(candidate) === normalise(matcher.pattern) && normalise(matcher.pattern) !== "";
}

export type ResolveInput = {
  positions: readonly PositionInput[];
  matchers: readonly Matcher[];
  operatingOfficeIds: readonly bigint[];
};

export type ResolvedAccess = {
  role: Role;
  /** The office whose LC total this member's points count towards (D-32). */
  scoringOfficeId: bigint | null;
  /** Offices this member may act within. Empty for ADMIN, who may act anywhere. */
  leadOfficeIds: bigint[];
  inScopePositions: PositionInput[];
};

export function resolveAccess({
  positions,
  matchers,
  operatingOfficeIds,
}: ResolveInput): ResolvedAccess {
  const operating = new Set(operatingOfficeIds.map(String));

  // Scope is applied before anything else. A position in a closed office, or in
  // an office outside the subtree entirely, confers nothing -- the service token
  // is entity-wide, so GIS grants no isolation of its own (Architecture 4.4).
  const inScope = positions.filter(
    (position) => isActive(position) && operating.has(String(position.officeId))
  );

  if (inScope.length === 0) {
    return { role: "DENIED", scoringOfficeId: null, leadOfficeIds: [], inScopePositions: [] };
  }

  const isAdmin = inScope.some((position) =>
    matchers.some((matcher) => matches(position, matcher))
  );

  const leadOfficeIds = [
    ...new Set(
      inScope
        .filter((position) => LEAD_ROLE_NAMES.has((position.roleName ?? "").trim().toUpperCase()))
        .map((position) => String(position.officeId))
    ),
  ].map(BigInt);

  const role: Role = isAdmin ? "ADMIN" : leadOfficeIds.length > 0 ? "LEAD" : "MEMBER";

  return {
    role,
    scoringOfficeId: chooseScoringOffice(inScope),
    leadOfficeIds,
    inScopePositions: inScope,
  };
}

/**
 * One office per member. Seniority decides, because an MCVP who also holds an LC
 * position would otherwise make their points count twice (D-32).
 */
export function chooseScoringOffice(positions: readonly PositionInput[]): bigint | null {
  if (positions.length === 0) return null;

  const ranked = [...positions].sort((a, b) => rank(a) - rank(b));
  return ranked[0].officeId;
}

function rank(position: PositionInput): number {
  const index = ROLE_SENIORITY.indexOf((position.roleName ?? "").trim().toUpperCase());
  return index === -1 ? ROLE_SENIORITY.length : index;
}

export function canActInOffice(access: ResolvedAccess, officeId: bigint): boolean {
  if (access.role === "ADMIN") return true;
  if (access.role === "LEAD") return access.leadOfficeIds.some((id) => id === officeId);
  return false;
}

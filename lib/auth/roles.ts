import type { MatcherField } from "@prisma/client";

// Pure role resolution: no I/O, so it can be unit-tested exhaustively. The
// caller supplies the positions, the matcher list and the operating offices.

export type Role = "ADMIN" | "LEAD" | "MEMBER" | "DENIED";

export type PositionInput = {
  officeId: bigint;
  roleName: string | null;
  title: string | null;
  status: string | null;
  /** Null when EXPA set no end date, which counts as not ended. */
  endDate: Date | null;
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
// holds several positions, so their points land in exactly one LC total (D-32),
// and the one role they share an EP's points under (D-73).
export const ROLE_SENIORITY: readonly string[] = ["MCP", "MCVP", "LCP", "LCVP", "TL", "ESTL", "ESTM", "TM"];

function isActive(position: Pick<PositionInput, "status">): boolean {
  return position.status?.toLowerCase() === ACTIVE_STATUS;
}

/**
 * The one test of "holds a member position this term" (D-71): active, in an
 * operating office, and not ended before the term start. Status alone is not
 * enough -- EXPA routinely leaves a departed member's position "active" after
 * its end date. `inTermMemberWhere()` (lib/org/members.ts) is the same rule as
 * a Prisma filter; change them together.
 */
export function isInTermPosition(
  position: Pick<PositionInput, "status" | "officeId" | "endDate">,
  operatingOfficeIds: ReadonlySet<string>,
  termStart: Date
): boolean {
  return (
    isActive(position) &&
    operatingOfficeIds.has(String(position.officeId)) &&
    (position.endDate === null || position.endDate >= termStart)
  );
}

/** GIS dates arrive as strings; an unparseable one is treated as absent. */
export function parseGisDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  termStart: Date;
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
  termStart,
}: ResolveInput): ResolvedAccess {
  const operating = new Set(operatingOfficeIds.map(String));

  // Scope is applied before anything else. A position in a closed office, in an
  // office outside the subtree entirely, or one that ended before this term
  // confers nothing -- the service token is entity-wide, so GIS grants no
  // isolation of its own (Architecture 4.4).
  const inScope = positions.filter((position) =>
    isInTermPosition(position, operating, termStart)
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

/**
 * The role a member takes a share of an EP's points under (D-73): the role of
 * their most senior position, ranked as D-32 ranks them, so an LCP who is also
 * an LCVP shares as an LCP. Pass only in-term positions.
 */
export function primaryRole(positions: readonly Pick<PositionInput, "roleName">[]): string | null {
  const ranked = [...positions].sort((a, b) => rank(a) - rank(b));
  const role = ranked[0]?.roleName?.trim().toUpperCase();
  return role ? role : null;
}

function rank(position: Pick<PositionInput, "roleName">): number {
  const index = ROLE_SENIORITY.indexOf((position.roleName ?? "").trim().toUpperCase());
  return index === -1 ? ROLE_SENIORITY.length : index;
}

export function canActInOffice(access: ResolvedAccess, officeId: bigint): boolean {
  if (access.role === "ADMIN") return true;
  if (access.role === "LEAD") return access.leadOfficeIds.some((id) => id === officeId);
  return false;
}

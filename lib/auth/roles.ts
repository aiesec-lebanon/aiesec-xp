import type { MatcherField } from "@prisma/client";

export type Role = "ADMIN" | "LEAD" | "MEMBER" | "DENIED";

export type PositionInput = {
  officeId: bigint;
  roleName: string | null;
  title: string | null;
  status: string | null;
  /** Null counts as not ended. */
  endDate: Date | null;
};

export type Matcher = {
  field: MatcherField;
  pattern: string;
};

// GIS reports an in-force position as "active"; "current" is not a status value.
const ACTIVE_STATUS = "active";

const LEAD_ROLE_NAMES = new Set(["LCP", "LCVP", "TL"]);

// Most senior first.
export const ROLE_SENIORITY: readonly string[] = ["MCP", "MCVP", "LCP", "LCVP", "TL", "ESTL", "ESTM", "TM"];

function isActive(position: Pick<PositionInput, "status">): boolean {
  return position.status?.toLowerCase() === ACTIVE_STATUS;
}

// EXPA often leaves a departed member's position "active" past its end date.
// inTermMemberWhere() in lib/org/members.ts is the Prisma twin; change them together.
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
  scoringOfficeId: bigint | null;
  /** Empty for ADMIN, who may act anywhere. */
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

  // Scope first: the service token is entity-wide, so GIS provides no isolation.
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

// One office per member, so an MCVP who also holds an LC position isn't counted twice.
export function chooseScoringOffice(positions: readonly PositionInput[]): bigint | null {
  if (positions.length === 0) return null;

  const ranked = [...positions].sort((a, b) => rank(a) - rank(b));
  return ranked[0].officeId;
}

// Pass only in-term positions.
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

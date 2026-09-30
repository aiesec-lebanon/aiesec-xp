import { describe, expect, it } from "vitest";

import {
  canActInOffice,
  chooseScoringOffice,
  isInTermPosition,
  parseGisDate,
  primaryRole,
  resolveAccess,
  type Matcher,
  type PositionInput,
} from "@/lib/auth/roles";

// The seeded matchers, as measured against office 182 at the spike (O-03).
const MATCHERS: Matcher[] = [
  { field: "ROLE_NAME", pattern: "MCP" },
  { field: "TITLE", pattern: "MCVP IM" },
  { field: "TITLE", pattern: "MCM IM" },
  { field: "TITLE", pattern: "MCVP oGX" },
  { field: "TITLE", pattern: "MCVP TM" },
];

const MC = 182n;
const AUB = 6550n;
const LAU = 5854n;
const CLOSED = 5853n; // Haigazian: in the tree, not operating
const OUTSIDE = 2107n; // Global Teams: outside the 182 subtree entirely

const OPERATING = [MC, AUB, LAU, 1735n];
const TERM_START = new Date("2026-08-01T00:00:00Z");

function position(over: Partial<PositionInput> = {}): PositionInput {
  return {
    officeId: AUB,
    roleName: "TM",
    title: "Member",
    status: "active",
    endDate: null,
    ...over,
  };
}

function resolve(positions: PositionInput[]) {
  return resolveAccess({
    positions,
    matchers: MATCHERS,
    operatingOfficeIds: OPERATING,
    termStart: TERM_START,
  });
}

describe("scope", () => {
  it("denies a person with no positions at all", () => {
    expect(resolve([]).role).toBe("DENIED");
  });

  it("denies a position outside the office subtree", () => {
    expect(resolve([position({ officeId: OUTSIDE, roleName: "MCVP" })]).role).toBe("DENIED");
  });

  it("denies a position in a closed office, however senior", () => {
    expect(resolve([position({ officeId: CLOSED, roleName: "LCP", title: "President" })]).role).toBe(
      "DENIED"
    );
  });

  it("denies an inactive position in an operating office", () => {
    expect(resolve([position({ status: "terminated" })]).role).toBe("DENIED");
  });

  it("treats 'current' as inactive, since GIS never reports it", () => {
    expect(resolve([position({ status: "current" })]).role).toBe("DENIED");
  });

  it("grants access on an active position in an operating office", () => {
    expect(resolve([position()]).role).toBe("MEMBER");
  });

  it("ignores an out-of-scope position while honouring an in-scope one", () => {
    const access = resolve([position({ officeId: OUTSIDE, roleName: "MCVP" }), position()]);
    expect(access.role).toBe("MEMBER");
    expect(access.inScopePositions).toHaveLength(1);
  });
});

describe("term (D-71)", () => {
  it("denies a position that ended before the term, though EXPA still calls it active", () => {
    const ended = position({ endDate: new Date("2026-07-31T00:00:00Z") });
    expect(resolve([ended]).role).toBe("DENIED");
  });

  it("does not let a departed president keep admin", () => {
    const ended = position({
      officeId: MC,
      roleName: "MCP",
      title: "President",
      endDate: new Date("2026-01-31T00:00:00Z"),
    });
    expect(resolve([ended]).role).toBe("DENIED");
  });

  it("counts a position ending on the term start day", () => {
    expect(resolve([position({ endDate: TERM_START })]).role).toBe("MEMBER");
  });

  it("counts a position ending later in the term", () => {
    expect(resolve([position({ endDate: new Date("2027-01-31T00:00:00Z") })]).role).toBe("MEMBER");
  });

  it("counts a position with no end date as not ended", () => {
    expect(resolve([position({ endDate: null })]).role).toBe("MEMBER");
  });

  it("is the same test isInTermPosition applies on its own", () => {
    const operating = new Set(OPERATING.map(String));
    expect(isInTermPosition(position(), operating, TERM_START)).toBe(true);
    expect(isInTermPosition(position({ status: "terminated" }), operating, TERM_START)).toBe(false);
    expect(isInTermPosition(position({ officeId: CLOSED }), operating, TERM_START)).toBe(false);
    expect(
      isInTermPosition(position({ endDate: new Date("2026-07-31T00:00:00Z") }), operating, TERM_START)
    ).toBe(false);
  });
});

describe("parseGisDate", () => {
  it("parses a GIS date string", () => {
    expect(parseGisDate("2027-01-31")).toEqual(new Date("2027-01-31T00:00:00Z"));
  });

  it("treats a missing or unparseable date as absent", () => {
    expect(parseGisDate(null)).toBeNull();
    expect(parseGisDate(undefined)).toBeNull();
    expect(parseGisDate("")).toBeNull();
    expect(parseGisDate("not a date")).toBeNull();
  });
});

describe("admin matching", () => {
  it("matches MCP on role name", () => {
    expect(resolve([position({ officeId: MC, roleName: "MCP", title: "President" })]).role).toBe(
      "ADMIN"
    );
  });

  it("matches the IM on either title spelling", () => {
    for (const title of ["MCVP IM", "MCM IM"]) {
      expect(resolve([position({ officeId: MC, roleName: "MCVP", title })]).role).toBe("ADMIN");
    }
  });

  it("matches MCVP oGX and MCVP TM on title", () => {
    for (const title of ["MCVP oGX", "MCVP TM"]) {
      expect(resolve([position({ officeId: MC, roleName: "MCVP", title })]).role).toBe("ADMIN");
    }
  });

  it("does not hand admin to other MCVPs", () => {
    for (const title of ["MCM MXP", "MCVP MKT & OGX", "MCVP MKT & oGX"]) {
      expect(resolve([position({ officeId: MC, roleName: "MCVP", title })]).role).not.toBe("ADMIN");
    }
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(resolve([position({ officeId: MC, roleName: "MCVP", title: "  mcvp im " })]).role).toBe(
      "ADMIN"
    );
  });

  it("does not match on a substring", () => {
    expect(
      resolve([position({ officeId: MC, roleName: "MCVP", title: "MCVP IM Assistant" })]).role
    ).not.toBe("ADMIN");
  });

  it("refuses to treat an empty pattern as a wildcard", () => {
    const access = resolveAccess({
      positions: [position({ roleName: null, title: null })],
      matchers: [{ field: "TITLE", pattern: "" }],
      operatingOfficeIds: OPERATING,
      termStart: TERM_START,
    });
    expect(access.role).not.toBe("ADMIN");
  });

  it("does not grant admin from a matching position in a closed office", () => {
    expect(
      resolve([position({ officeId: CLOSED, roleName: "MCP", title: "President" })]).role
    ).toBe("DENIED");
  });
});

describe("lead", () => {
  it.each(["LCP", "LCVP", "TL"])("treats %s as a LEAD", (roleName) => {
    const access = resolve([position({ roleName })]);
    expect(access.role).toBe("LEAD");
    expect(access.leadOfficeIds).toEqual([AUB]);
  });

  it("treats a plain team member as MEMBER", () => {
    expect(resolve([position({ roleName: "TM" })]).role).toBe("MEMBER");
  });

  it("prefers ADMIN when a person is both", () => {
    expect(
      resolve([position({ roleName: "LCP" }), position({ officeId: MC, roleName: "MCP" })]).role
    ).toBe("ADMIN");
  });

  it("collects every office a LEAD holds a position in", () => {
    const access = resolve([
      position({ officeId: AUB, roleName: "LCVP" }),
      position({ officeId: LAU, roleName: "TL" }),
    ]);
    expect(access.leadOfficeIds.map(String).sort()).toEqual([String(LAU), String(AUB)].sort());
  });
});

describe("office access", () => {
  it("lets an ADMIN act anywhere, including an office they hold no position in", () => {
    const access = resolve([position({ officeId: MC, roleName: "MCP" })]);
    expect(canActInOffice(access, LAU)).toBe(true);
  });

  it("confines a LEAD to their own office", () => {
    const access = resolve([position({ officeId: AUB, roleName: "LCVP" })]);
    expect(canActInOffice(access, AUB)).toBe(true);
    expect(canActInOffice(access, LAU)).toBe(false);
  });

  it("lets a MEMBER act nowhere", () => {
    const access = resolve([position({ roleName: "TM" })]);
    expect(canActInOffice(access, AUB)).toBe(false);
  });
});

describe("scoring office (D-32)", () => {
  it("picks the most senior position, so points land in one LC only", () => {
    const chosen = chooseScoringOffice([
      position({ officeId: AUB, roleName: "TM" }),
      position({ officeId: MC, roleName: "MCVP" }),
    ]);
    expect(chosen).toBe(MC);
  });

  it("is stable regardless of the order positions arrive in", () => {
    const a = chooseScoringOffice([
      position({ officeId: MC, roleName: "MCVP" }),
      position({ officeId: AUB, roleName: "LCP" }),
    ]);
    const b = chooseScoringOffice([
      position({ officeId: AUB, roleName: "LCP" }),
      position({ officeId: MC, roleName: "MCVP" }),
    ]);
    expect(a).toBe(b);
    expect(a).toBe(MC);
  });

  it("falls back to the only position when the role is unrecognised", () => {
    expect(chooseScoringOffice([position({ officeId: LAU, roleName: "SOMETHING NEW" })])).toBe(LAU);
  });

  it("is null when there are no positions", () => {
    expect(chooseScoringOffice([])).toBeNull();
  });

  it("is derived from in-scope positions only", () => {
    const access = resolve([
      position({ officeId: OUTSIDE, roleName: "MCP" }),
      position({ officeId: LAU, roleName: "TM" }),
    ]);
    expect(access.scoringOfficeId).toBe(LAU);
  });
});

describe("primaryRole (D-73)", () => {
  it("shares under the most senior role a member holds", () => {
    // Measured: an LCP who is also LCVP MKT, and a TL who is also LCVP MoGX.
    expect(primaryRole([{ roleName: "LCVP" }, { roleName: "LCP" }])).toBe("LCP");
    expect(primaryRole([{ roleName: "TL" }, { roleName: "LCVP" }])).toBe("LCVP");
  });

  it("normalises the role name, since shares are keyed by it", () => {
    expect(primaryRole([{ roleName: " tm " }])).toBe("TM");
  });

  it("ranks an unknown role after every known one", () => {
    expect(primaryRole([{ roleName: "SOMETHING NEW" }, { roleName: "TM" }])).toBe("TM");
    expect(primaryRole([{ roleName: "SOMETHING NEW" }])).toBe("SOMETHING NEW");
  });

  it("is null for a member with no role", () => {
    expect(primaryRole([])).toBeNull();
    expect(primaryRole([{ roleName: null }])).toBeNull();
  });
});

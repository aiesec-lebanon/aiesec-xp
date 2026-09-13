import { describe, expect, it } from "vitest";

import {
  canActInOffice,
  chooseScoringOffice,
  resolveAccess,
  type Matcher,
  type PositionInput,
} from "@/lib/auth/roles";

// The seeded matchers, as measured against office 182 at the spike (O-03).
const MATCHERS: Matcher[] = [
  { field: "ROLE_NAME", pattern: "MCP" },
  { field: "TITLE", pattern: "MCVP IM" },
  { field: "TITLE", pattern: "MCM IM" },
];

const MC = 182n;
const AUB = 6550n;
const LAU = 5854n;
const CLOSED = 5853n; // Haigazian: in the tree, not operating
const OUTSIDE = 2107n; // Global Teams: outside the 182 subtree entirely

const OPERATING = [MC, AUB, LAU, 1735n];

function position(over: Partial<PositionInput> = {}): PositionInput {
  return { officeId: AUB, roleName: "TM", title: "Member", status: "active", ...over };
}

function resolve(positions: PositionInput[]) {
  return resolveAccess({ positions, matchers: MATCHERS, operatingOfficeIds: OPERATING });
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

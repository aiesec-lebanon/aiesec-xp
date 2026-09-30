import { describe, expect, it } from "vitest";

import { readRoleShares } from "@/lib/scoring/config";
import { splitShares, validateRoleShares } from "@/lib/scoring/shares";

const SHARES = { TM: 50, TL: 30, LCVP: 20 };

const shareOf = (split: Map<string, number>, member: bigint) => split.get(String(member)) ?? 0;

describe("splitShares (D-73)", () => {
  it("gives a member alone on an EP all of it, whatever their role", () => {
    for (const role of ["TM", "LCVP", "MCP", null]) {
      expect(shareOf(splitShares([{ memberId: 1n, role }], SHARES), 1n)).toBe(1);
    }
  });

  it("uses the configured shares when every role is present", () => {
    const split = splitShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 2n, role: "TL" },
        { memberId: 3n, role: "LCVP" },
      ],
      SHARES
    );
    expect(shareOf(split, 1n)).toBeCloseTo(0.5);
    expect(shareOf(split, 2n)).toBeCloseTo(0.3);
    expect(shareOf(split, 3n)).toBeCloseTo(0.2);
  });

  it("rescales over the roles actually on the EP, so the points are paid in full", () => {
    const split = splitShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 2n, role: "LCVP" },
      ],
      SHARES
    );
    expect(shareOf(split, 1n)).toBeCloseTo(50 / 70);
    expect(shareOf(split, 2n)).toBeCloseTo(20 / 70);
    expect([...split.values()].reduce((sum, share) => sum + share, 0)).toBeCloseTo(1);
  });

  it("splits a role's share evenly between the people holding it", () => {
    const split = splitShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 2n, role: "TM" },
        { memberId: 3n, role: "TL" },
      ],
      SHARES
    );
    expect(shareOf(split, 1n)).toBeCloseTo((50 / 80) / 2);
    expect(shareOf(split, 2n)).toBeCloseTo((50 / 80) / 2);
    expect(shareOf(split, 3n)).toBeCloseTo(30 / 80);
  });

  it("gives a role with no share nothing beside a role that has one", () => {
    const split = splitShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 2n, role: "ESTL" },
      ],
      SHARES
    );
    expect(shareOf(split, 1n)).toBe(1);
    expect(shareOf(split, 2n)).toBe(0);
  });

  it("splits evenly when nobody on the EP has a share, rather than paying out nothing", () => {
    const split = splitShares(
      [
        { memberId: 1n, role: "ESTL" },
        { memberId: 2n, role: null },
      ],
      SHARES
    );
    expect(shareOf(split, 1n)).toBe(0.5);
    expect(shareOf(split, 2n)).toBe(0.5);
  });

  it("matches roles regardless of case and spacing", () => {
    const split = splitShares(
      [
        { memberId: 1n, role: " tm " },
        { memberId: 2n, role: "Tl" },
      ],
      SHARES
    );
    expect(shareOf(split, 1n)).toBeCloseTo(50 / 80);
  });

  it("counts a member listed twice once", () => {
    const split = splitShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 1n, role: "TM" },
        { memberId: 2n, role: "TM" },
      ],
      SHARES
    );
    expect(split.size).toBe(2);
    expect(shareOf(split, 1n)).toBe(0.5);
  });

  it("ignores a negative or non-numeric share rather than paying it", () => {
    const split = splitShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 2n, role: "TL" },
      ],
      { TM: 50, TL: -30 }
    );
    expect(shareOf(split, 1n)).toBe(1);
    expect(shareOf(split, 2n)).toBe(0);
  });

  it("is empty for nobody", () => {
    expect(splitShares([], SHARES).size).toBe(0);
  });
});

describe("validateRoleShares", () => {
  it("accepts shares totalling 100", () => {
    expect(validateRoleShares({ TM: 50, TL: 30, LCVP: 20 })).toEqual([]);
    expect(validateRoleShares({ TM: 12.5, TL: 87.5 })).toEqual([]);
  });

  it("refuses a total other than 100, and says what it adds up to", () => {
    const [problem] = validateRoleShares({ TM: 50, TL: 30 });
    expect(problem.message).toMatch(/80%/);
  });

  it("refuses a share outside 0 to 100", () => {
    expect(validateRoleShares({ TM: 120, TL: -20 }).length).toBeGreaterThan(0);
  });

  it("refuses a share that is not a number", () => {
    expect(validateRoleShares({ TM: Number.NaN, TL: 100 }).length).toBeGreaterThan(0);
  });
});

describe("readRoleShares", () => {
  it("normalises the stored role names", () => {
    expect(readRoleShares({ tm: 60, " TL ": 40 })).toEqual({ TM: 60, TL: 40 });
  });

  it("drops anything that is not a number", () => {
    expect(readRoleShares({ TM: "60", TL: 40 })).toEqual({ TL: 40 });
  });

  it("reads a missing or malformed value as no shares", () => {
    expect(readRoleShares(null)).toEqual({});
    expect(readRoleShares([1, 2])).toEqual({});
  });
});

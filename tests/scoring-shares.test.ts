import { describe, expect, it } from "vitest";

import { readRoleShares } from "@/lib/scoring/config";
import { creditShares, roleFraction, validateRoleShares } from "@/lib/scoring/shares";

const SHARES = { TM: 40, TL: 30, LCVP: 25, MCP: 10 };

const shareOf = (split: Map<string, number>, member: bigint) => split.get(String(member));

describe("creditShares (D-83)", () => {
  it("gives the main manager everything and everyone else their role's %", () => {
    const split = creditShares(
      [
        { memberId: 1n, role: "MCP" },
        { memberId: 2n, role: "TL" },
        { memberId: 3n, role: "LCVP" },
      ],
      1n,
      SHARES
    );
    expect(shareOf(split, 1n)).toBe(1);
    expect(shareOf(split, 2n)).toBe(0.3);
    expect(shareOf(split, 3n)).toBe(0.25);
  });

  it("gives everyone in a role the role's full %", () => {
    const split = creditShares(
      [
        { memberId: 1n, role: "MCP" },
        { memberId: 2n, role: "TM" },
        { memberId: 3n, role: "TM" },
      ],
      1n,
      SHARES
    );
    expect(shareOf(split, 2n)).toBe(0.4);
    expect(shareOf(split, 3n)).toBe(0.4);
  });

  it("gives everyone their role's % when no main is picked", () => {
    const split = creditShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 2n, role: "TL" },
      ],
      null,
      SHARES
    );
    expect(shareOf(split, 1n)).toBe(0.4);
    expect(shareOf(split, 2n)).toBe(0.3);
  });

  it("gives a manager alone on the EP everything when no main is picked, whatever their role", () => {
    for (const role of ["TM", "MCP", "ESTL", null]) {
      expect(shareOf(creditShares([{ memberId: 1n, role }], null, SHARES), 1n)).toBe(1);
    }
  });

  it("promotes nobody when the main can no longer be credited, even a manager left alone", () => {
    expect(shareOf(creditShares([{ memberId: 2n, role: "TL" }], 9n, SHARES), 2n)).toBe(0.3);
  });

  it("gives a role with no % set nothing", () => {
    const split = creditShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 2n, role: "ESTL" },
        { memberId: 3n, role: null },
      ],
      1n,
      SHARES
    );
    expect(shareOf(split, 2n)).toBe(0);
    expect(shareOf(split, 3n)).toBe(0);
  });

  it("matches roles regardless of case and spacing", () => {
    const split = creditShares(
      [
        { memberId: 1n, role: " tm " },
        { memberId: 2n, role: "Tl" },
      ],
      null,
      SHARES
    );
    expect(shareOf(split, 1n)).toBe(0.4);
    expect(shareOf(split, 2n)).toBe(0.3);
  });

  it("counts a member listed twice once", () => {
    const split = creditShares(
      [
        { memberId: 1n, role: "TM" },
        { memberId: 1n, role: "TM" },
      ],
      null,
      SHARES
    );
    expect(split.size).toBe(1);
    expect(shareOf(split, 1n)).toBe(1);
  });

  it("is empty for nobody", () => {
    expect(creditShares([], 1n, SHARES).size).toBe(0);
  });
});

describe("roleFraction", () => {
  it("ignores a negative or non-numeric % rather than paying it", () => {
    expect(roleFraction({ TL: -30 }, "TL")).toBe(0);
    expect(roleFraction({ TL: Number.NaN }, "TL")).toBe(0);
  });

  it("caps a % above 100 at the whole event", () => {
    expect(roleFraction({ TL: 150 }, "TL")).toBe(1);
  });
});

describe("validateRoleShares", () => {
  it("accepts any % from 0 to 100, with no total required", () => {
    expect(validateRoleShares({ TM: 40, TL: 30, MCP: 10 })).toEqual([]);
    expect(validateRoleShares({ TM: 0, TL: 100 })).toEqual([]);
  });

  it("refuses a % outside 0 to 100", () => {
    expect(validateRoleShares({ TM: 120, TL: -20 })).toHaveLength(2);
  });

  it("refuses a % that is not a number", () => {
    expect(validateRoleShares({ TM: Number.NaN })).toHaveLength(1);
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

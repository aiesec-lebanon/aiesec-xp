import { describe, expect, it } from "vitest";

import { isActiveCredit, planSource, type RegisterRow } from "@/lib/assignments/plan";

const EP = 5000n;
const ALICE = 1n;
const BOB = 2n;

let seq = 0;
function row(over: Partial<RegisterRow> = {}): RegisterRow {
  seq += 1;
  return {
    id: `row-${seq}`,
    epPersonId: EP,
    memberId: ALICE,
    fromExpa: false,
    fromSheet: false,
    fromAdmin: false,
    isMain: false,
    removedAt: null,
    ...over,
  };
}

const desired = (entries: [bigint, bigint[]][]) =>
  new Map(entries.map(([ep, members]) => [String(ep), new Set(members.map(String))]));

describe("planSource (D-73)", () => {
  it("credits a manager EXPA names for the first time", () => {
    const plan = planSource([], desired([[EP, [ALICE]]]), "EXPA");
    expect(plan.create).toEqual([{ epPersonId: EP, memberId: ALICE }]);
  });

  it("adds the source to a member an admin already credited, without a second row", () => {
    const admin = row({ fromAdmin: true });
    const plan = planSource([admin], desired([[EP, [ALICE]]]), "EXPA");
    expect(plan.create).toEqual([]);
    expect(plan.set).toEqual([admin.id]);
  });

  it("changes nothing when the source already says the same", () => {
    const plan = planSource([row({ fromExpa: true })], desired([[EP, [ALICE]]]), "EXPA");
    expect(plan).toEqual({ create: [], set: [], clear: [], drop: [] });
  });

  it("drops a credit the source no longer names and nothing else holds", () => {
    const stale = row({ fromExpa: true });
    const plan = planSource([stale], desired([[EP, [BOB]]]), "EXPA");
    expect(plan.drop).toEqual([stale.id]);
    expect(plan.create).toEqual([{ epPersonId: EP, memberId: BOB }]);
  });

  it("keeps a credit another source still holds, clearing only this one", () => {
    const shared = row({ fromExpa: true, fromSheet: true });
    const plan = planSource([shared], desired([[EP, []]]), "EXPA");
    expect(plan.clear).toEqual([shared.id]);
    expect(plan.drop).toEqual([]);
  });

  it("never undoes an admin's removal, and keeps the row so it stays removed", () => {
    const removed = row({ fromExpa: true, removedAt: new Date("2026-09-01T00:00:00Z") });
    expect(planSource([removed], desired([[EP, [ALICE]]]), "EXPA")).toEqual({
      create: [],
      set: [],
      clear: [],
      drop: [],
    });

    const gone = planSource([removed], desired([[EP, []]]), "EXPA");
    expect(gone.clear).toEqual([removed.id]);
    expect(gone.drop).toEqual([]);
  });

  it("leaves an EP the source said nothing about alone, so an unreadable sheet takes no credit", () => {
    const sheet = row({ fromSheet: true });
    expect(planSource([sheet], desired([[9999n, [BOB]]]), "SHEET").drop).toEqual([]);
  });

  it("touches only its own source", () => {
    const expa = row({ fromExpa: true });
    const plan = planSource([expa], desired([[EP, []]]), "SHEET");
    expect(plan).toEqual({ create: [], set: [], clear: [], drop: [] });
  });

  it("credits several managers of one EP at once", () => {
    const plan = planSource([], desired([[EP, [ALICE, BOB]]]), "EXPA");
    expect(plan.create).toHaveLength(2);
  });
});

describe("a main pick (D-83)", () => {
  it("keeps the main on the EP when EXPA drops them", () => {
    const main = row({ fromExpa: true, isMain: true });
    const plan = planSource([main], desired([[EP, []]]), "EXPA");
    expect(plan.clear).toEqual([main.id]);
    expect(plan.drop).toEqual([]);
  });

  it("counts as a credit on its own", () => {
    expect(isActiveCredit(row({ isMain: true }))).toBe(true);
    expect(isActiveCredit(row({ isMain: true, removedAt: new Date() }))).toBe(false);
  });
});

describe("isActiveCredit", () => {
  it("counts a credit some source names", () => {
    expect(isActiveCredit(row({ fromSheet: true }))).toBe(true);
  });

  it("does not count a removed credit, whatever names it", () => {
    expect(isActiveCredit(row({ fromExpa: true, fromAdmin: true, removedAt: new Date() }))).toBe(false);
  });

  it("does not count a row nothing names", () => {
    expect(isActiveCredit(row())).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  addDays,
  clampIso,
  formatDisplay,
  formatFull,
  isWithin,
  monthGrid,
  monthLabel,
  monthOf,
  parseIso,
  shiftMonth,
} from "@/lib/design/calendar";

// The date field renders its own calendar rather than the browser's, so this is
// the month arithmetic behind it. Everything is UTC: a date in this product is a
// day with no time in it, and reading one back in the browser's zone would shift
// it for anyone west of UTC.

describe("parseIso", () => {
  it("accepts a real date", () => {
    expect(parseIso("2026-08-01")?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("rejects a day that does not exist in that month", () => {
    expect(parseIso("2026-02-30")).toBeNull();
    expect(parseIso("2026-13-01")).toBeNull();
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(parseIso("1 Aug 2026")).toBeNull();
    expect(parseIso("")).toBeNull();
  });
});

describe("monthGrid", () => {
  it("always returns six rows, so paging does not resize the popover", () => {
    expect(monthGrid({ year: 2026, month: 7 })).toHaveLength(42);
    // February 2027 starts on a Monday and has 28 days: five rows would do.
    expect(monthGrid({ year: 2027, month: 1 })).toHaveLength(42);
  });

  it("starts the week on Monday", () => {
    // 1 August 2026 is a Saturday, so the row leads with 27 July.
    const grid = monthGrid({ year: 2026, month: 7 });

    expect(grid[0]).toEqual({ iso: "2026-07-27", day: 27, inMonth: false });
    expect(grid[5]).toEqual({ iso: "2026-08-01", day: 1, inMonth: true });
  });

  it("marks the borrowed days either side as outside the month", () => {
    const grid = monthGrid({ year: 2026, month: 7 });
    const inMonth = grid.filter((cell) => cell.inMonth);

    expect(inMonth).toHaveLength(31);
    expect(inMonth[0].iso).toBe("2026-08-01");
    expect(inMonth[30].iso).toBe("2026-08-31");
  });

  it("handles a leap February", () => {
    const inMonth = monthGrid({ year: 2024, month: 1 }).filter((cell) => cell.inMonth);

    expect(inMonth).toHaveLength(29);
    expect(inMonth[28].iso).toBe("2024-02-29");
  });
});

describe("shiftMonth", () => {
  it("rolls forward over a year boundary", () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  it("rolls back over a year boundary", () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("monthOf", () => {
  it("reads the month a date sits in", () => {
    expect(monthOf("2026-09-18")).toEqual({ year: 2026, month: 8 });
  });

  it("falls back for an unparseable value", () => {
    expect(monthOf("nonsense", new Date("2026-08-01T00:00:00.000Z"))).toEqual({
      year: 2026,
      month: 7,
    });
  });
});

describe("addDays", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("goes backwards", () => {
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("moves a whole week, which is what the up and down arrows do", () => {
    expect(addDays("2026-08-01", 7)).toBe("2026-08-08");
  });
});

describe("bounds", () => {
  it("clamps to either end", () => {
    expect(clampIso("2024-01-01", "2026-08-01", "2026-09-18")).toBe("2026-08-01");
    expect(clampIso("2027-01-01", "2026-08-01", "2026-09-18")).toBe("2026-09-18");
    expect(clampIso("2026-08-15", "2026-08-01", "2026-09-18")).toBe("2026-08-15");
  });

  it("treats both bounds as inclusive", () => {
    expect(isWithin("2026-08-01", "2026-08-01", "2026-09-18")).toBe(true);
    expect(isWithin("2026-09-18", "2026-08-01", "2026-09-18")).toBe(true);
    expect(isWithin("2026-07-31", "2026-08-01", "2026-09-18")).toBe(false);
  });
});

describe("formatting", () => {
  it("shows a short date in the closed field", () => {
    expect(formatDisplay("2026-08-01")).toBe("1 Aug 2026");
  });

  it("spells the month out for assistive technology", () => {
    expect(formatFull("2026-08-01")).toBe("1 August 2026");
  });

  it("labels the calendar header", () => {
    expect(monthLabel({ year: 2026, month: 7 })).toBe("August 2026");
  });
});

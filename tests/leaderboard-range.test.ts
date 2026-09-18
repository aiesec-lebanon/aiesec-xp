import { describe, expect, it } from "vitest";

import { resolveRange } from "@/lib/leaderboard-range";

// D-58. The leaderboards take any historic range, floored at the term start:
// nothing before it was collected, and nothing before it could be attributed to
// the right member anyway. Every bound is echoed back, so a request that gets
// clamped is visible in the date inputs rather than silently ignored.

const TERM_START = new Date("2026-08-01T00:00:00.000Z");
const NOW = new Date("2026-09-18T14:30:00.000Z");

describe("resolveRange", () => {
  it("defaults to the term start through today", () => {
    const range = resolveRange({}, TERM_START, NOW);

    expect(range.from).toBe("2026-08-01");
    expect(range.to).toBe("2026-09-18");
    expect(range.isDefault).toBe(true);
  });

  it("covers the whole of the last day, so today's events count", () => {
    const { endsAt } = resolveRange({}, TERM_START, NOW);

    expect(endsAt.toISOString()).toBe("2026-09-18T23:59:59.999Z");
  });

  it("starts at midnight, so the first day's events count", () => {
    const { startsAt } = resolveRange({ from: "2026-08-15" }, TERM_START, NOW);

    expect(startsAt.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("keeps a range inside the term", () => {
    const range = resolveRange({ from: "2026-08-10", to: "2026-08-31" }, TERM_START, NOW);

    expect(range.from).toBe("2026-08-10");
    expect(range.to).toBe("2026-08-31");
    expect(range.isDefault).toBe(false);
  });

  it("clamps a start before the term up to the term start", () => {
    const range = resolveRange({ from: "2024-01-01" }, TERM_START, NOW);

    expect(range.from).toBe("2026-08-01");
  });

  it("clamps an end in the future down to today", () => {
    const range = resolveRange({ to: "2027-12-31" }, TERM_START, NOW);

    expect(range.to).toBe("2026-09-18");
  });

  it("clamps an end before the start up to the start", () => {
    const range = resolveRange({ from: "2026-09-01", to: "2026-08-05" }, TERM_START, NOW);

    expect(range.from).toBe("2026-09-01");
    expect(range.to).toBe("2026-09-01");
  });

  it("falls back to the default for anything that is not a date", () => {
    const range = resolveRange({ from: "last tuesday", to: "2026-13-45" }, TERM_START, NOW);

    expect(range.from).toBe("2026-08-01");
    expect(range.to).toBe("2026-09-18");
  });

  it("exposes the floor and ceiling the inputs constrain themselves with", () => {
    const range = resolveRange({}, TERM_START, NOW);

    expect(range.floor).toBe("2026-08-01");
    expect(range.ceiling).toBe("2026-09-18");
  });

  it("survives a term start configured in the future", () => {
    const range = resolveRange({}, new Date("2027-01-01T00:00:00.000Z"), NOW);

    expect(range.from).toBe("2027-01-01");
    expect(range.to).toBe("2027-01-01");
    expect(range.endsAt > range.startsAt).toBe(true);
  });
});

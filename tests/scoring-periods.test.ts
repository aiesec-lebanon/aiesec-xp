import { describe, expect, it } from "vitest";

import type { ScoringConfig } from "@/lib/scoring/engine";
import { weightSegments, weightsAt, type WeightPeriod } from "@/lib/scoring/periods";

function config(version: number): ScoringConfig {
  return {
    version,
    aplPoints: 1,
    apdPoints: 5,
    rePoints: 10,
    reverseApl: true,
    aplReversingStatuses: [],
    productWeights: { "7": 1 },
    directionWeights: { OUTGOING: 1 },
    roleShares: {},
  };
}

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const endOf = (value: string) => new Date(`${value}T23:59:59.999Z`);

function period(version: number, startsAt: string, endsAt: string | null, savedAt: string): WeightPeriod {
  return { startsAt: day(startsAt), endsAt: endsAt ? endOf(endsAt) : null, savedAt: day(savedAt), config: config(version) };
}

describe("weightsAt (D-85)", () => {
  it("uses the period a moment falls in", () => {
    const at = weightsAt([
      period(1, "2026-08-01", "2026-08-31", "2026-08-01"),
      period(2, "2026-09-01", "2026-09-30", "2026-09-01"),
    ]);
    expect(at(day("2026-08-15")).version).toBe(1);
    expect(at(endOf("2026-08-31")).version).toBe(1);
    expect(at(day("2026-09-01")).version).toBe(2);
  });

  it("lets the most recently saved period win an overlap, even over a later start", () => {
    const at = weightsAt([
      period(1, "2026-09-01", "2026-09-30", "2026-09-01"),
      period(2, "2026-08-15", null, "2026-10-01"),
    ]);
    expect(at(day("2026-09-10")).version).toBe(2);
    expect(at(day("2026-08-20")).version).toBe(2);
  });

  it("keeps a past period's weights where the newer one does not reach", () => {
    const at = weightsAt([
      period(1, "2026-08-01", "2027-07-31", "2026-08-01"),
      period(2, "2026-10-01", "2026-10-31", "2026-10-01"),
    ]);
    expect(at(day("2026-09-15")).version).toBe(1);
    expect(at(day("2026-10-15")).version).toBe(2);
    expect(at(day("2026-11-15")).version).toBe(1);
  });

  it("fills a gap with the period that started most recently before it", () => {
    const at = weightsAt([
      period(1, "2026-08-01", "2026-08-31", "2026-08-01"),
      period(2, "2026-09-01", "2026-09-10", "2026-09-01"),
      period(3, "2026-10-01", null, "2026-10-01"),
    ]);
    expect(at(day("2026-09-20")).version).toBe(2);
  });

  it("falls back to the earliest period before every period", () => {
    const at = weightsAt([
      period(1, "2026-08-01", null, "2026-08-01"),
      period(2, "2026-09-01", null, "2026-09-01"),
    ]);
    expect(at(day("2026-01-01")).version).toBe(1);
  });

  it("refuses to resolve with no periods at all", () => {
    expect(() => weightsAt([])).toThrow();
  });
});

describe("weightSegments", () => {
  const at = weightsAt([
    period(1, "2026-08-01", "2026-08-31", "2026-08-01"),
    period(2, "2026-09-01", "2026-09-30", "2026-09-01"),
    period(2, "2026-10-01", null, "2026-10-01"),
  ]);

  it("asks for one run of days per change of weights", () => {
    const segments = weightSegments({ startsAt: day("2026-08-20"), endsAt: endOf("2026-10-05") }, at);
    expect(segments.map(({ startDate, endDate, config }) => [startDate, endDate, config.version])).toEqual([
      ["2026-08-20", "2026-08-31", 1],
      ["2026-09-01", "2026-10-05", 2],
    ]);
  });

  it("is one segment for a range inside one period", () => {
    const segments = weightSegments({ startsAt: day("2026-08-02"), endsAt: endOf("2026-08-02") }, at);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ startDate: "2026-08-02", endDate: "2026-08-02" });
  });
});

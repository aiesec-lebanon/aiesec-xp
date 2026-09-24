import { describe, expect, it } from "vitest";

import { byNewestApplication, latestApplication } from "@/lib/admin/ep-order";

const at = (iso: string) => new Date(`${iso}T09:00:00.000Z`);

describe("latestApplication", () => {
  it("takes the latest APL of an EP who applied more than once", () => {
    const events = [
      { eventType: "APL", occurredAt: at("2026-08-10") },
      { eventType: "APL", occurredAt: at("2026-09-02") },
      { eventType: "APL", occurredAt: at("2026-08-20") },
    ];
    expect(latestApplication(events)).toEqual(at("2026-09-02"));
  });

  it("ignores approvals and realizations, which are not when the EP applied", () => {
    const events = [
      { eventType: "APL", occurredAt: at("2026-08-10") },
      { eventType: "APD", occurredAt: at("2026-09-15") },
      { eventType: "RE", occurredAt: at("2026-09-20") },
    ];
    expect(latestApplication(events)).toEqual(at("2026-08-10"));
  });

  it("is null for an EP whose application predates the term, so holds no APL", () => {
    expect(latestApplication([{ eventType: "APD", occurredAt: at("2026-09-15") }])).toBeNull();
  });
});

describe("byNewestApplication", () => {
  const row = (epPersonId: string, appliedAt: Date | null, fullName: string | null = null) => ({
    epPersonId,
    appliedAt,
    fullName,
  });

  it("puts the newest application first", () => {
    const rows = [
      row("1", at("2026-08-01")),
      row("2", at("2026-09-20")),
      row("3", at("2026-09-01")),
    ];
    expect(rows.sort(byNewestApplication).map((r) => r.epPersonId)).toEqual(["2", "3", "1"]);
  });

  it("puts an EP with no application in range after every dated one", () => {
    const rows = [row("1", null, "Aline"), row("2", at("2026-08-01"), "Zeina")];
    expect(rows.sort(byNewestApplication).map((r) => r.epPersonId)).toEqual(["2", "1"]);
  });

  it("breaks a tie on the day by name, named EPs first, then by id", () => {
    const day = at("2026-09-01");
    const rows = [row("30", day), row("20", day, "Rami"), row("10", day, "Maya"), row("5", day)];
    expect(rows.sort(byNewestApplication).map((r) => r.epPersonId)).toEqual(["10", "20", "30", "5"]);
  });
});

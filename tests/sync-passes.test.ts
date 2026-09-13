import { describe, expect, it } from "vitest";

import {
  dedupe,
  isBreakSuperseded,
  mapRow,
  occurrenceDate,
  PASSES,
  type ApplicationRow,
} from "@/lib/sync/passes";

const PROGRAMMES = new Set([7, 8, 9]);
const OPTIONS = { side: "PERSON" as const, allowedProgrammeIds: PROGRAMMES };

type Meta = Partial<{
  date_approved: string | null;
  date_approval_broken: string | null;
  date_realized: string | null;
  date_realisation_broke: string | null;
  remote_realized_at: string | null;
  date_rejected: string | null;
  date_withdrawn: string | null;
}>;

function row(over: { id?: string; status?: string; created_at?: string; programme?: string; meta?: Meta } = {}) {
  return {
    id: over.id ?? "7163866",
    status: over.status ?? "open",
    created_at: over.created_at ?? "2026-08-31T10:41:48Z",
    person: {
      id: "5534242",
      home_lc: { id: "1735" },
    },
    managers: [{ id: "999" }],
    opportunity: {
      id: "1338627",
      programme: { id: over.programme ?? "8" },
      home_lc: { id: "813" },
    },
    meta: {
      date_approved: null,
      date_approval_broken: null,
      date_realized: null,
      date_realisation_broke: null,
      remote_realized_at: null,
      date_rejected: null,
      date_withdrawn: null,
      ...over.meta,
    },
  } as unknown as ApplicationRow;
}

describe("pass definitions", () => {
  it("covers every funnel stage the spike found data for", () => {
    expect(PASSES.map((pass) => pass.name)).toEqual([
      "apl",
      "apd",
      "re",
      "re_remote",
      "apd_broken",
      "re_broken",
    ]);
  });

  it("leaves the break passes unsorted, since GIS offers no sort for those dates", () => {
    for (const pass of PASSES) {
      if (pass.eventType.endsWith("_BROKEN")) expect(pass.sortField).toBeNull();
    }
  });
});

describe("occurrenceDate", () => {
  it("takes APL from the application's own created_at", () => {
    expect(occurrenceDate(row(), "APL")?.toISOString()).toBe("2026-08-31T10:41:48.000Z");
  });

  it("takes APD from meta.date_approved", () => {
    const at = occurrenceDate(row({ meta: { date_approved: "2026-08-21T11:36:01Z" } }), "APD");
    expect(at?.toISOString()).toBe("2026-08-21T11:36:01.000Z");
  });

  it("takes the earlier of physical and remote realization (D-29)", () => {
    const at = occurrenceDate(
      row({
        meta: { date_realized: "2026-07-02T12:17:32Z", remote_realized_at: "2026-06-30T09:00:00Z" },
      }),
      "RE"
    );
    expect(at?.toISOString()).toBe("2026-06-30T09:00:00.000Z");
  });

  it("falls back to whichever realization date exists", () => {
    expect(
      occurrenceDate(row({ meta: { remote_realized_at: "2026-06-30T09:00:00Z" } }), "RE")
    ).not.toBeNull();
    expect(
      occurrenceDate(row({ meta: { date_realized: "2026-07-02T12:17:32Z" } }), "RE")
    ).not.toBeNull();
  });

  it("is null when the stage has not happened", () => {
    expect(occurrenceDate(row(), "APD")).toBeNull();
    expect(occurrenceDate(row(), "RE")).toBeNull();
  });

  it("is null for an unparseable date rather than an invalid Date", () => {
    expect(occurrenceDate(row({ meta: { date_approved: "not a date" } }), "APD")).toBeNull();
  });
});

describe("break supersession (D-28)", () => {
  it("ignores a break the stage date has overtaken", () => {
    const approved = row({
      meta: { date_approved: "2026-08-20T00:00:00Z", date_approval_broken: "2026-08-10T00:00:00Z" },
    });
    expect(isBreakSuperseded(approved, "APD_BROKEN")).toBe(true);
    expect(mapRow(approved, "APD_BROKEN", OPTIONS)).toBeNull();
  });

  it("keeps a break that is later than the stage it reverses", () => {
    const broken = row({
      meta: { date_approved: "2026-08-01T00:00:00Z", date_approval_broken: "2026-08-10T00:00:00Z" },
    });
    expect(isBreakSuperseded(broken, "APD_BROKEN")).toBe(false);
    expect(mapRow(broken, "APD_BROKEN", OPTIONS)).not.toBeNull();
  });

  it("keeps a break with no stage date at all", () => {
    const orphan = row({ meta: { date_approval_broken: "2026-08-10T00:00:00Z" } });
    expect(isBreakSuperseded(orphan, "APD_BROKEN")).toBe(false);
  });

  it("applies the same rule to realization breaks", () => {
    const superseded = row({
      meta: {
        date_realized: "2026-09-01T00:00:00Z",
        date_realisation_broke: "2026-08-01T00:00:00Z",
      },
    });
    expect(isBreakSuperseded(superseded, "RE_BROKEN")).toBe(true);
  });

  it("never treats a stage event as superseded", () => {
    expect(isBreakSuperseded(row(), "APL")).toBe(false);
    expect(isBreakSuperseded(row({ meta: { date_approved: "2026-08-01T00:00:00Z" } }), "APD")).toBe(
      false
    );
  });
});

describe("mapRow", () => {
  it("maps a complete APL row", () => {
    const event = mapRow(row(), "APL", OPTIONS);
    expect(event).toMatchObject({
      applicationId: 7163866n,
      eventType: "APL",
      epPersonId: 5534242n,
      programmeId: 8,
      direction: "OUTGOING",
      personHomeLcId: 1735n,
      opportunityHomeLcId: 813n,
      applicationStatus: "open",
      gisManagerIds: [999n],
    });
  });

  it("marks the person side OUTGOING and the opportunity side INCOMING (D-25)", () => {
    expect(mapRow(row(), "APL", OPTIONS)?.direction).toBe("OUTGOING");
    expect(
      mapRow(row(), "APL", { side: "OPPORTUNITY", allowedProgrammeIds: PROGRAMMES })?.direction
    ).toBe("INCOMING");
  });

  it("stores no EP personal data beyond the id needed to attribute (D-40, D-42)", () => {
    const event = mapRow(row(), "APL", OPTIONS)!;
    expect(Object.keys(event).join(" ")).not.toMatch(/email|phone|name|title/i);
  });

  it("keeps epPersonId, without which nothing can be attributed", () => {
    expect(mapRow(row(), "APL", OPTIONS)?.epPersonId).toBe(5534242n);
  });

  it("drops a programme outside the configured set", () => {
    expect(mapRow(row({ programme: "1" }), "APL", OPTIONS)).toBeNull();
  });

  it("follows the configured set rather than a hardcoded list", () => {
    const event = mapRow(row({ programme: "1" }), "APL", {
      side: "PERSON",
      allowedProgrammeIds: new Set([1]),
    });
    expect(event?.programmeId).toBe(1);
  });

  it("returns null rather than throwing on a malformed row", () => {
    for (const broken of [
      { ...(row() as Record<string, unknown>), id: null },
      { ...(row() as Record<string, unknown>), person: null },
      { ...(row() as Record<string, unknown>), opportunity: null },
      { ...(row() as Record<string, unknown>), created_at: null },
    ]) {
      expect(() => mapRow(broken as ApplicationRow, "APL", OPTIONS)).not.toThrow();
      expect(mapRow(broken as ApplicationRow, "APL", OPTIONS)).toBeNull();
    }
  });

  it("tolerates an application with no managers", () => {
    const unmanaged = { ...(row() as Record<string, unknown>), managers: null };
    expect(mapRow(unmanaged as ApplicationRow, "APL", OPTIONS)?.gisManagerIds).toEqual([]);
  });
});

describe("idempotency", () => {
  it("produces a stable key, so a rerun over the overlap window updates in place", () => {
    const first = mapRow(row(), "APL", OPTIONS)!;
    const second = mapRow(row(), "APL", OPTIONS)!;
    expect(`${first.applicationId}:${first.eventType}`).toBe(
      `${second.applicationId}:${second.eventType}`
    );
  });

  it("collapses the physical and remote RE passes onto one event", () => {
    const physical = mapRow(
      row({ meta: { date_realized: "2026-07-02T12:17:32Z" } }),
      "RE",
      OPTIONS
    )!;
    const remote = mapRow(
      row({ meta: { remote_realized_at: "2026-06-30T09:00:00Z" } }),
      "RE",
      OPTIONS
    )!;

    const deduped = dedupe([physical, remote]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].occurredAt.toISOString()).toBe("2026-06-30T09:00:00.000Z");
  });

  it("keeps different stages of the same application apart", () => {
    const apl = mapRow(row(), "APL", OPTIONS)!;
    const apd = mapRow(row({ meta: { date_approved: "2026-09-01T00:00:00Z" } }), "APD", OPTIONS)!;
    expect(dedupe([apl, apd])).toHaveLength(2);
  });

  it("keeps different applications apart", () => {
    const a = mapRow(row({ id: "1" }), "APL", OPTIONS)!;
    const b = mapRow(row({ id: "2" }), "APL", OPTIONS)!;
    expect(dedupe([a, b])).toHaveLength(2);
  });

  it("is order-independent", () => {
    const early = mapRow(row({ meta: { date_realized: "2026-01-01T00:00:00Z" } }), "RE", OPTIONS)!;
    const late = mapRow(row({ meta: { date_realized: "2026-09-01T00:00:00Z" } }), "RE", OPTIONS)!;
    expect(dedupe([early, late])[0].occurredAt).toEqual(dedupe([late, early])[0].occurredAt);
  });

  it("is a no-op on an empty batch", () => {
    expect(dedupe([])).toEqual([]);
  });
});

describe("application status, for net APL (D-41)", () => {
  it.each(["withdrawn", "rejected", "open", "approved", "matched", "finished", "completed"])(
    "carries the %s status through to the event",
    (status) => {
      expect(mapRow(row({ status }), "APL", OPTIONS)?.applicationStatus).toBe(status);
    }
  );

  it("does not drop a withdrawn application at ingest; scoring decides", () => {
    expect(mapRow(row({ status: "withdrawn" }), "APL", OPTIONS)).not.toBeNull();
  });
});

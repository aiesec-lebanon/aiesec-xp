import { describe, expect, it } from "vitest";

import {
  EVENT_TYPES,
  isBreakSuperseded,
  managerIds,
  mapApplication,
  occurrenceDate,
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
  date_remote_realization_broken_at: string | null;
}>;

function row(
  over: {
    id?: string;
    status?: string;
    created_at?: string;
    updated_at?: string;
    programme?: string;
    managers?: { id: string }[] | null;
    meta?: Meta;
  } = {}
) {
  return {
    id: over.id ?? "3000001",
    status: over.status ?? "open",
    created_at: over.created_at ?? "2026-08-31T10:41:48Z",
    updated_at: over.updated_at ?? "2026-09-25T16:10:37Z",
    person: { id: "1000002", managers: over.managers === undefined ? [{ id: "2000001" }] : over.managers },
    opportunity: {
      id: "4000001",
      programme: { id: over.programme ?? "8" },
    },
    meta: {
      date_approved: null,
      date_approval_broken: null,
      date_realized: null,
      date_realisation_broke: null,
      remote_realized_at: null,
      date_remote_realization_broken_at: null,
      ...over.meta,
    },
  } as unknown as ApplicationRow;
}

const types = (mapped: ReturnType<typeof mapApplication>) => mapped.map((event) => event.eventType);

describe("occurrenceDate", () => {
  it("takes APL from the application's own created_at", () => {
    expect(occurrenceDate(row(), "APL")?.toISOString()).toBe("2026-08-31T10:41:48.000Z");
  });

  it("takes APD from meta.date_approved", () => {
    const at = occurrenceDate(row({ meta: { date_approved: "2026-08-21T11:36:01Z" } }), "APD");
    expect(at?.toISOString()).toBe("2026-08-21T11:36:01.000Z");
  });

  it("takes the earlier of physical and remote realization", () => {
    const at = occurrenceDate(
      row({ meta: { date_realized: "2026-07-02T12:17:32Z", remote_realized_at: "2026-06-30T09:00:00Z" } }),
      "RE"
    );
    expect(at?.toISOString()).toBe("2026-06-30T09:00:00.000Z");
  });

  it("falls back to whichever realization date exists", () => {
    expect(occurrenceDate(row({ meta: { remote_realized_at: "2026-06-30T09:00:00Z" } }), "RE")).not.toBeNull();
    expect(occurrenceDate(row({ meta: { date_realized: "2026-07-02T12:17:32Z" } }), "RE")).not.toBeNull();
  });

  it("dates a broken remote realization like a broken physical one", () => {
    const at = occurrenceDate(
      row({ meta: { date_remote_realization_broken_at: "2026-09-10T00:00:00Z" } }),
      "RE_BROKEN"
    );
    expect(at?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
  });

  it("is null when the stage has not happened", () => {
    expect(occurrenceDate(row(), "APD")).toBeNull();
    expect(occurrenceDate(row(), "RE")).toBeNull();
  });

  it("is null for an unparseable date rather than an invalid Date", () => {
    expect(occurrenceDate(row({ meta: { date_approved: "not a date" } }), "APD")).toBeNull();
  });
});

describe("break supersession", () => {
  it("ignores a break the stage date has overtaken", () => {
    const approved = row({
      meta: { date_approved: "2026-08-20T00:00:00Z", date_approval_broken: "2026-08-10T00:00:00Z" },
    });
    expect(isBreakSuperseded(approved, "APD_BROKEN")).toBe(true);
    expect(types(mapApplication(approved, OPTIONS))).not.toContain("APD_BROKEN");
  });

  it("keeps a break that is later than the stage it reverses", () => {
    const broken = row({
      meta: { date_approved: "2026-08-01T00:00:00Z", date_approval_broken: "2026-08-10T00:00:00Z" },
    });
    expect(isBreakSuperseded(broken, "APD_BROKEN")).toBe(false);
    expect(types(mapApplication(broken, OPTIONS))).toContain("APD_BROKEN");
  });

  it("keeps a break with no stage date at all, as GIS leaves it after clearing the approval", () => {
    const orphan = row({ status: "approval_broken", meta: { date_approval_broken: "2026-08-19T00:00:00Z" } });
    expect(isBreakSuperseded(orphan, "APD_BROKEN")).toBe(false);
    expect(types(mapApplication(orphan, OPTIONS))).toEqual(["APL", "APD_BROKEN"]);
  });

  it("applies the same rule to realization breaks", () => {
    const superseded = row({
      meta: { date_realized: "2026-09-01T00:00:00Z", date_realisation_broke: "2026-08-01T00:00:00Z" },
    });
    expect(isBreakSuperseded(superseded, "RE_BROKEN")).toBe(true);
  });

  it("never treats a stage event as superseded", () => {
    expect(isBreakSuperseded(row(), "APL")).toBe(false);
    expect(isBreakSuperseded(row({ meta: { date_approved: "2026-08-01T00:00:00Z" } }), "APD")).toBe(false);
  });
});

describe("mapApplication", () => {
  it("maps every stage an application has reached, in funnel order", () => {
    const realized = row({
      status: "completed",
      meta: { date_approved: "2026-04-18T00:00:00Z", date_realized: "2026-07-30T00:00:00Z" },
    });
    expect(types(mapApplication(realized, OPTIONS))).toEqual(["APL", "APD", "RE"]);
  });

  it("maps an open application to its APL alone", () => {
    expect(mapApplication(row(), OPTIONS)).toEqual([
      {
        applicationId: 3000001n,
        eventType: "APL",
        occurredAt: new Date("2026-08-31T10:41:48Z"),
        epPersonId: 1000002n,
        programmeId: 8,
        direction: "OUTGOING",
        applicationStatus: "open",
      },
    ]);
  });

  it("carries the application's current status on every event", () => {
    const events = mapApplication(
      row({ status: "approved", meta: { date_approved: "2026-09-27T00:00:00Z" } }),
      OPTIONS
    );
    expect(events.every((event) => event.applicationStatus === "approved")).toBe(true);
  });

  it("marks the person side OUTGOING and the opportunity side INCOMING", () => {
    expect(mapApplication(row(), OPTIONS)[0].direction).toBe("OUTGOING");
    expect(
      mapApplication(row(), { side: "OPPORTUNITY", allowedProgrammeIds: PROGRAMMES })[0].direction
    ).toBe("INCOMING");
  });

  it("stores no EP personal data beyond the id needed to attribute", () => {
    const [event] = mapApplication(row(), OPTIONS);
    expect(Object.keys(event).join(" ")).not.toMatch(/email|phone|name|title|manager/i);
  });

  it("carries only the fields scoring reads", () => {
    expect(Object.keys(mapApplication(row(), OPTIONS)[0]).sort()).toEqual([
      "applicationId",
      "applicationStatus",
      "direction",
      "epPersonId",
      "eventType",
      "occurredAt",
      "programmeId",
    ]);
  });

  it("drops a programme outside the configured set", () => {
    expect(mapApplication(row({ programme: "1" }), OPTIONS)).toEqual([]);
  });

  it("follows the configured set rather than a hardcoded list", () => {
    const [event] = mapApplication(row({ programme: "1" }), {
      side: "PERSON",
      allowedProgrammeIds: new Set([1]),
    });
    expect(event.programmeId).toBe(1);
  });

  it("returns nothing rather than throwing on a malformed row", () => {
    for (const broken of [
      { ...(row() as Record<string, unknown>), id: null },
      { ...(row() as Record<string, unknown>), person: null },
      { ...(row() as Record<string, unknown>), opportunity: null },
    ]) {
      expect(() => mapApplication(broken as ApplicationRow, OPTIONS)).not.toThrow();
      expect(mapApplication(broken as ApplicationRow, OPTIONS)).toEqual([]);
    }
  });

  it("produces one event per type, the idempotency key the upsert relies on", () => {
    const events = mapApplication(
      row({ meta: { date_realized: "2026-07-02T00:00:00Z", remote_realized_at: "2026-06-30T00:00:00Z" } }),
      OPTIONS
    );
    const keys = events.map((event) => `${event.applicationId}:${event.eventType}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not drop a withdrawn application at ingest; scoring decides", () => {
    expect(mapApplication(row({ status: "withdrawn" }), OPTIONS)).toHaveLength(1);
  });

  it("knows every event type the schema declares", () => {
    expect([...EVENT_TYPES].sort()).toEqual(["APD", "APD_BROKEN", "APL", "RE", "RE_BROKEN"]);
  });
});

describe("managerIds", () => {
  it("reads the EP's managers as ids", () => {
    expect(managerIds([{ id: "2000001" }, { id: "2000004" }])).toEqual([2000001n, 2000004n]);
  });

  it("drops duplicates and nulls", () => {
    expect(managerIds([{ id: "1" }, null, { id: "1" }])).toEqual([1n]);
  });

  it("reads no managers as an empty list", () => {
    expect(managerIds([])).toEqual([]);
    expect(managerIds(null)).toEqual([]);
  });
});

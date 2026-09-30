import type { Direction, FunnelEvent } from "@prisma/client";

import type { ApplicationsQuery } from "@/gis/generated";

// Pure mapping from a GIS application row to the events it implies. No I/O, so
// the date-selection and supersession rules can be tested without a database
// or a live API.

export type ApplicationRow = NonNullable<
  NonNullable<NonNullable<ApplicationsQuery["allOpportunityApplication"]>["data"]>[number]
>;

export type ScopeSide = "PERSON" | "OPPORTUNITY";

/** Every event one application row can carry, in funnel order. */
export const EVENT_TYPES = [
  "APL",
  "APD",
  "RE",
  "APD_BROKEN",
  "RE_BROKEN",
] as const satisfies readonly FunnelEvent[];

// Scoring facts only. No EP name and no opportunity title: those are read live
// from GIS when something is displayed, never stored (D-42).
export type MappedEvent = {
  applicationId: bigint;
  eventType: FunnelEvent;
  occurredAt: Date;
  epPersonId: bigint;
  programmeId: number;
  direction: Direction;
  applicationStatus: string | null;
};

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function earliest(...values: (string | null | undefined)[]): Date | null {
  let found: Date | null = null;
  for (const value of values) {
    const date = parseDate(value);
    if (date && (!found || date < found)) found = date;
  }
  return found;
}

function toBigInt(value: string | number | null | undefined): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * When an event occurred, by type.
 *
 * RE takes the earlier of the physical and remote dates (D-29), and a broken
 * realization likewise, since remote realization can break on its own date.
 */
export function occurrenceDate(row: ApplicationRow, eventType: FunnelEvent): Date | null {
  const meta = row.meta;

  switch (eventType) {
    case "APL":
      return parseDate(row.created_at);
    case "APD":
      return parseDate(meta?.date_approved);
    case "RE":
      return earliest(meta?.date_realized, meta?.remote_realized_at);
    case "APD_BROKEN":
      return parseDate(meta?.date_approval_broken);
    case "RE_BROKEN":
      return earliest(meta?.date_realisation_broke, meta?.date_remote_realization_broken_at);
  }
}

/**
 * A break is superseded when the stage it reverses has a later date, which is
 * how an approve, break, re-approve sequence ends up scoring as approved
 * (D-28). Superseded breaks are not ingested at all.
 */
export function isBreakSuperseded(row: ApplicationRow, eventType: FunnelEvent): boolean {
  const stage = eventType === "APD_BROKEN" ? "APD" : eventType === "RE_BROKEN" ? "RE" : null;
  if (!stage) return false;

  const breakAt = occurrenceDate(row, eventType);
  const stageAt = occurrenceDate(row, stage);
  return breakAt !== null && stageAt !== null && stageAt > breakAt;
}

export type MapOptions = {
  side: ScopeSide;
  /** Programme ids that are in scope, taken from the active config. */
  allowedProgrammeIds: ReadonlySet<number>;
};

/**
 * Every event one GIS application row implies, or none when the row should not
 * be ingested. Never throws: a malformed row must not abort a pass and strand
 * the watermark, and the counts reported by the run make a skipped row visible.
 */
export function mapApplication(row: ApplicationRow, { side, allowedProgrammeIds }: MapOptions): MappedEvent[] {
  const applicationId = toBigInt(row.id);
  const epPersonId = toBigInt(row.person?.id);
  const programmeId = row.opportunity?.programme?.id ? Number(row.opportunity.programme.id) : null;

  if (!applicationId || !epPersonId || programmeId === null || !Number.isInteger(programmeId)) return [];
  if (!allowedProgrammeIds.has(programmeId)) return [];

  return EVENT_TYPES.flatMap((eventType) => {
    const occurredAt = occurrenceDate(row, eventType);
    if (!occurredAt || isBreakSuperseded(row, eventType)) return [];
    return [
      {
        applicationId,
        eventType,
        occurredAt,
        epPersonId,
        programmeId,
        // D-25: the person side is what decides direction, so an application
        // that is Lebanese on both sides is OUTGOING and stored once.
        direction: side === "PERSON" ? "OUTGOING" : "INCOMING",
        applicationStatus: row.status ?? null,
      },
    ];
  });
}

/** Who manages the EP in EXPA, by person id (D-74). */
export function managerIds(managers: readonly ({ id: string } | null)[] | null | undefined): bigint[] {
  const ids = new Set<string>();
  for (const manager of managers ?? []) {
    const id = toBigInt(manager?.id);
    if (id) ids.add(String(id));
  }
  return [...ids].map(BigInt);
}

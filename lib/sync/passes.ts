import type { Direction, FunnelEvent } from "@prisma/client";

import type { ApplicationsQuery } from "@/gis/generated";

// Pure mapping from a GIS application row to the events it implies. No I/O, so
// the idempotency and date-selection rules can be tested without a database or
// a live API.

export type ApplicationRow = NonNullable<
  NonNullable<ApplicationsQuery["allOpportunityApplication"]>["data"]
>[number];

export type ScopeSide = "PERSON" | "OPPORTUNITY";

/**
 * A sync pass: the GIS date filter it queries on, and the event that filter
 * produces. RE has two passes because GIS dates physical and remote
 * realization separately, and both mean the same thing (D-29).
 */
export type PassDefinition = {
  readonly name: string;
  readonly filterField:
    | "created_at"
    | "date_approved"
    | "date_realized"
    | "date_remote_realized"
    | "date_approval_broken"
    | "date_realisation_broke";
  readonly eventType: FunnelEvent;
  /** GIS has no sort option for the break dates, so those passes go unsorted. */
  readonly sortField: "created_at" | "date_approved" | "date_realized" | null;
};

export const PASSES: readonly PassDefinition[] = [
  { name: "apl", filterField: "created_at", eventType: "APL", sortField: "created_at" },
  { name: "apd", filterField: "date_approved", eventType: "APD", sortField: "date_approved" },
  { name: "re", filterField: "date_realized", eventType: "RE", sortField: "date_realized" },
  {
    name: "re_remote",
    filterField: "date_remote_realized",
    eventType: "RE",
    sortField: null,
  },
  {
    name: "apd_broken",
    filterField: "date_approval_broken",
    eventType: "APD_BROKEN",
    sortField: null,
  },
  {
    name: "re_broken",
    filterField: "date_realisation_broke",
    eventType: "RE_BROKEN",
    sortField: null,
  },
] as const;

export type MappedEvent = {
  applicationId: bigint;
  eventType: FunnelEvent;
  occurredAt: Date;
  epPersonId: bigint;
  epFullName: string;
  programmeId: number;
  direction: Direction;
  personHomeLcId: bigint | null;
  opportunityHomeLcId: bigint | null;
  opportunityTitle: string | null;
  applicationStatus: string | null;
  gisManagerIds: bigint[];
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
 * RE takes the earlier of the physical and remote dates (D-29): an application
 * carrying both is one realization, and the earlier date is when the EP
 * actually started.
 */
export function occurrenceDate(row: ApplicationRow, eventType: FunnelEvent): Date | null {
  const meta = row?.meta;

  switch (eventType) {
    case "APL":
      return parseDate(row?.created_at);
    case "APD":
      return parseDate(meta?.date_approved);
    case "RE": {
      const physical = parseDate(meta?.date_realized);
      const remote = parseDate(meta?.remote_realized_at);
      if (physical && remote) return physical <= remote ? physical : remote;
      return physical ?? remote;
    }
    case "APD_BROKEN":
      return parseDate(meta?.date_approval_broken);
    case "RE_BROKEN":
      return parseDate(meta?.date_realisation_broke);
    default:
      return null;
  }
}

/**
 * A break is superseded when the stage it reverses has a later date, which is
 * how an approve, break, re-approve sequence ends up scoring as approved
 * (D-28). Superseded breaks are not ingested at all, so the ledger never has to
 * reason about them.
 */
export function isBreakSuperseded(row: ApplicationRow, eventType: FunnelEvent): boolean {
  const breakAt = occurrenceDate(row, eventType);
  if (!breakAt) return false;

  const stage = eventType === "APD_BROKEN" ? "APD" : eventType === "RE_BROKEN" ? "RE" : null;
  if (!stage) return false;

  const stageAt = occurrenceDate(row, stage);
  return stageAt !== null && stageAt > breakAt;
}

export type MapOptions = {
  side: ScopeSide;
  /** Programme ids that are in scope, taken from the active config. */
  allowedProgrammeIds: ReadonlySet<number>;
};

/**
 * Maps one GIS row to one event, or null when the row should not be ingested.
 *
 * Returns null rather than throwing: a malformed row must not abort a pass and
 * strand the watermark, and the counts reported by the run make a skipped row
 * visible.
 */
export function mapRow(
  row: ApplicationRow,
  eventType: FunnelEvent,
  { side, allowedProgrammeIds }: MapOptions
): MappedEvent | null {
  const applicationId = toBigInt(row?.id);
  const epPersonId = toBigInt(row?.person?.id);
  const occurredAt = occurrenceDate(row, eventType);
  const programmeId = row?.opportunity?.programme?.id
    ? Number(row.opportunity.programme.id)
    : null;

  if (!applicationId || !epPersonId || !occurredAt || programmeId === null) return null;
  if (!allowedProgrammeIds.has(programmeId)) return null;
  if (isBreakSuperseded(row, eventType)) return null;

  return {
    applicationId,
    eventType,
    occurredAt,
    epPersonId,
    epFullName: row?.person?.full_name ?? `Person ${epPersonId}`,
    programmeId,
    // D-25: the person side is what decides direction, so an application that
    // is Lebanese on both sides is OUTGOING and stored once.
    direction: side === "PERSON" ? "OUTGOING" : "INCOMING",
    personHomeLcId: toBigInt(row?.person?.home_lc?.id),
    opportunityHomeLcId: toBigInt(row?.opportunity?.home_lc?.id),
    opportunityTitle: row?.opportunity?.title ?? null,
    applicationStatus: row?.status ?? null,
    gisManagerIds: (row?.managers ?? []).flatMap((manager) => {
      const id = toBigInt(manager?.id);
      return id === null ? [] : [id];
    }),
  };
}

/**
 * Collapses rows that map to the same event. The physical and remote RE passes
 * can both return one application; the unique key would reject the second write,
 * so the earlier occurrence wins here instead.
 */
export function dedupe(events: readonly MappedEvent[]): MappedEvent[] {
  const byKey = new Map<string, MappedEvent>();

  for (const event of events) {
    const key = `${event.applicationId}:${event.eventType}`;
    const existing = byKey.get(key);
    if (!existing || event.occurredAt < existing.occurredAt) byKey.set(key, event);
  }

  return [...byKey.values()];
}

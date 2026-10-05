import type { Direction, FunnelEvent } from "@prisma/client";

import type { ApplicationsQuery } from "@/gis/generated";

export type ApplicationRow = NonNullable<
  NonNullable<NonNullable<ApplicationsQuery["allOpportunityApplication"]>["data"]>[number]
>;

export type ScopeSide = "PERSON" | "OPPORTUNITY";

export const EVENT_TYPES = [
  "APL",
  "APD",
  "RE",
  "APD_BROKEN",
  "RE_BROKEN",
] as const satisfies readonly FunnelEvent[];

// No EP name or opportunity title: those are read live from GIS, never stored.
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

// RE and RE_BROKEN take the earlier of the physical and remote dates; remote can break on its own date.
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

// A break is superseded when its stage has a later date, so approve-break-reapprove scores as approved.
export function isBreakSuperseded(row: ApplicationRow, eventType: FunnelEvent): boolean {
  const stage = eventType === "APD_BROKEN" ? "APD" : eventType === "RE_BROKEN" ? "RE" : null;
  if (!stage) return false;

  const breakAt = occurrenceDate(row, eventType);
  const stageAt = occurrenceDate(row, stage);
  return breakAt !== null && stageAt !== null && stageAt > breakAt;
}

export type MapOptions = {
  side: ScopeSide;
  allowedProgrammeIds: ReadonlySet<number>;
};

// Never throws: a malformed row must not abort a pass and strand the watermark.
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
        // The person side decides direction, so a Lebanese-on-both-sides application is OUTGOING once.
        direction: side === "PERSON" ? "OUTGOING" : "INCOMING",
        applicationStatus: row.status ?? null,
      },
    ];
  });
}

export function managerIds(managers: readonly ({ id: string } | null)[] | null | undefined): bigint[] {
  const ids = new Set<string>();
  for (const manager of managers ?? []) {
    const id = toBigInt(manager?.id);
    if (id) ids.add(String(id));
  }
  return [...ids].map(BigInt);
}

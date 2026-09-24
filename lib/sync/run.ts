import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { mcOfficeId } from "@/lib/env";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import {
  dedupe,
  mapRow,
  PASSES,
  type ApplicationRow,
  type MappedEvent,
  type PassDefinition,
  type ScopeSide,
} from "@/lib/sync/passes";
import { syncRoster } from "@/lib/sync/roster";
import { advanceWatermark, formatDate, OVERLAP_MS, windowFor } from "@/lib/sync/watermark";
import { syncOfficeTree } from "@/lib/org/office-tree";

const PAGE_SIZE = 250;
const MAX_PAGES = 200;

export type PassResult = {
  pass: string;
  rowsSeen: number;
  eventsWritten: number;
  rowsSkipped: number;
  status: "SUCCESS" | "FAILED";
  error?: string;
};

type SyncScope = {
  sides: ScopeSide[];
  allowedProgrammeIds: Set<number>;
};

/**
 * Sync scope comes from the active config, not from constants. The programmes
 * synced are exactly the programmes scored, so adding a product is one config
 * change rather than a code change (D-04), and enabling incoming exchange is
 * the same (D-27).
 */
async function resolveScope(): Promise<SyncScope> {
  const config = await db.scoreConfig.findFirst({ where: { isActive: true } });
  if (!config) throw new Error("No active ScoreConfig; sync has no scope to run in");

  const weights = config.productWeights as Record<string, unknown>;
  const allowedProgrammeIds = new Set(
    Object.keys(weights)
      .map(Number)
      .filter((id) => Number.isInteger(id))
  );
  if (allowedProgrammeIds.size === 0) {
    throw new Error("Active ScoreConfig has no productWeights; nothing would be synced");
  }

  const sides = (config.scopeSides as unknown[])
    .filter((side): side is ScopeSide => side === "PERSON" || side === "OPPORTUNITY");
  if (sides.length === 0) {
    throw new Error("Active ScoreConfig has no scopeSides; nothing would be synced");
  }

  return { sides, allowedProgrammeIds };
}

function scopeFilter(side: ScopeSide, officeId: bigint): Record<string, unknown> {
  return side === "PERSON"
    ? { person_home_mc: [Number(officeId)] }
    : { opportunity_home_mc: [Number(officeId)] };
}

async function* readPages(
  pass: PassDefinition,
  side: ScopeSide,
  officeId: bigint,
  from: Date,
  to: Date,
  programmes: number[]
): AsyncGenerator<ApplicationRow[]> {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await gis().Applications({
      filters: {
        [pass.filterField]: { from: formatDate(from), to: formatDate(to) },
        programmes,
        ...scopeFilter(side, officeId),
        ...(pass.sortField ? { sort: pass.sortField, sort_direction: "asc" } : {}),
      },
      page,
      perPage: PAGE_SIZE,
    });

    const body = result.allOpportunityApplication;
    const rows = (body?.data ?? []).filter((row): row is ApplicationRow => row !== null);
    if (rows.length > 0) yield rows;

    const totalPages = body?.paging?.total_pages ?? 0;
    if (page >= totalPages) return;
  }

  logger.warn("Sync pass hit the page ceiling; some records were not read", {
    pass: pass.name,
    maxPages: MAX_PAGES,
  });
}

async function writeEvents(events: readonly MappedEvent[]): Promise<number> {
  let written = 0;

  for (const event of events) {
    const data: Prisma.ExchangeEventUncheckedCreateInput = { ...event };
    // Upsert on the idempotency key, so a rerun over the overlap window updates
    // in place instead of duplicating.
    await db.exchangeEvent.upsert({
      where: {
        applicationId_eventType: {
          applicationId: event.applicationId,
          eventType: event.eventType,
        },
      },
      create: data,
      update: data,
    });
    written += 1;
  }

  return written;
}

export async function runPass(pass: PassDefinition, now = new Date()): Promise<PassResult> {
  const scope = await resolveScope();
  const officeId = mcOfficeId();
  const { from, to } = await windowFor(pass.name, now);
  const programmes = [...scope.allowedProgrammeIds];

  const run = await db.syncRun.create({ data: { pass: pass.name, status: "RUNNING" } });

  let rowsSeen = 0;
  let rowsSkipped = 0;
  let eventsWritten = 0;

  try {
    for (const side of scope.sides) {
      for await (const rows of readPages(pass, side, officeId, from, to, programmes)) {
        rowsSeen += rows.length;

        const mapped = rows.flatMap((row) => {
          const event = mapRow(row, pass.eventType, {
            side,
            allowedProgrammeIds: scope.allowedProgrammeIds,
          });
          if (!event) rowsSkipped += 1;
          return event ? [event] : [];
        });

        eventsWritten += await writeEvents(dedupe(mapped));
      }
    }

    // Only now, with every page of every side read: a watermark advanced on a
    // partial pass would silently skip whatever was missed.
    await advanceWatermark(pass.name, to);

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), eventsSeen: eventsWritten },
    });

    return { pass: pass.name, rowsSeen, eventsWritten, rowsSkipped, status: "SUCCESS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Sync pass failed", { pass: pass.name, error });

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), eventsSeen: eventsWritten, error: message },
    });

    return { pass: pass.name, rowsSeen, eventsWritten, rowsSkipped, status: "FAILED", error: message };
  }
}

/**
 * Pass 5b. Not a break pass and it emits no event: it refreshes the observed
 * status of applications already in the ledger, which is what makes the APL
 * count net (D-41). GIS offers no date filter for rejection or withdrawal, so
 * there is nothing to watermark and the pass re-reads what it already holds.
 */
export async function refreshApplicationStatuses(now = new Date()): Promise<PassResult> {
  const scope = await resolveScope();
  const officeId = mcOfficeId();
  const run = await db.syncRun.create({ data: { pass: "status", status: "RUNNING" } });

  let rowsSeen = 0;
  let updated = 0;

  try {
    const known = await db.exchangeEvent.findMany({
      where: { eventType: "APL" },
      select: { applicationId: true, occurredAt: true },
    });
    if (known.length === 0) {
      await db.syncRun.update({
        where: { id: run.id },
        data: { status: "SUCCESS", finishedAt: new Date(), eventsSeen: 0 },
      });
      return { pass: "status", rowsSeen: 0, eventsWritten: 0, rowsSkipped: 0, status: "SUCCESS" };
    }

    const knownIds = new Set(known.map((row) => String(row.applicationId)));

    const statusPass: PassDefinition = {
      name: "status",
      filterField: "created_at",
      eventType: "APL",
      sortField: "created_at",
    };

    // Spans what the ledger actually holds, not a watermark window. An
    // application can be withdrawn years after it was created, and the APL
    // watermark has already advanced past it by the time this pass runs.
    const oldest = known.reduce(
      (earliest, row) => (row.occurredAt < earliest ? row.occurredAt : earliest),
      known[0].occurredAt
    );
    const from = new Date(oldest.getTime() - OVERLAP_MS);

    for (const side of scope.sides) {
      for await (const rows of readPages(
        statusPass,
        side,
        officeId,
        from,
        now,
        [...scope.allowedProgrammeIds]
      )) {
        rowsSeen += rows.length;

        for (const row of rows) {
          const applicationId = row?.id ? BigInt(row.id) : null;
          if (!applicationId || !knownIds.has(String(applicationId))) continue;

          await db.exchangeEvent.updateMany({
            where: { applicationId, eventType: "APL" },
            data: { applicationStatus: row?.status ?? null },
          });
          updated += 1;
        }
      }
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), eventsSeen: updated },
    });

    return { pass: "status", rowsSeen, eventsWritten: updated, rowsSkipped: 0, status: "SUCCESS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Status refresh failed", { error });

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });

    return {
      pass: "status",
      rowsSeen,
      eventsWritten: updated,
      rowsSkipped: 0,
      status: "FAILED",
      error: message,
    };
  }
}

/**
 * Passes 1-5 and 5b: the EP data. One pass failing does not stop the others;
 * each owns its own watermark.
 */
export async function runEventPasses(now = new Date()): Promise<PassResult[]> {
  const results: PassResult[] = [];
  for (const pass of PASSES) results.push(await runPass(pass, now));
  results.push(await refreshApplicationStatuses(now));
  return results;
}

/**
 * Pass 8: the office tree, then the roster, which is read per operating office.
 * Scheduled monthly rather than with the EP data (D-66).
 */
export async function runMemberPasses(): Promise<PassResult[]> {
  return [
    await runStructuralPass("offices", async () => (await syncOfficeTree()).officesSeen),
    await runStructuralPass("roster", async () => (await syncRoster()).membersUpserted),
  ];
}

/** Everything, membership first. What the sync CLI runs. */
export async function runAllPasses(now = new Date()): Promise<PassResult[]> {
  return [...(await runMemberPasses()), ...(await runEventPasses(now))];
}

/**
 * Office tree and roster refresh state rather than ingesting dated events, so
 * they have no watermark. A failure is reported and the run continues: stale
 * membership is better than no sync at all.
 */
async function runStructuralPass(
  name: string,
  work: () => Promise<number>
): Promise<PassResult> {
  try {
    const count = await work();
    return { pass: name, rowsSeen: count, eventsWritten: count, rowsSkipped: 0, status: "SUCCESS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      pass: name,
      rowsSeen: 0,
      eventsWritten: 0,
      rowsSkipped: 0,
      status: "FAILED",
      error: message,
    };
  }
}

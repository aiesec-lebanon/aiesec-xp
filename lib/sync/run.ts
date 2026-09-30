import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { applySource, SYSTEM_ACTOR } from "@/lib/assignments/register";
import { mcOfficeId } from "@/lib/env";
import { gis } from "@/lib/gis/client";
import { importAssignments } from "@/lib/import/run-import";
import { logger } from "@/lib/logger";
import {
  managerIds,
  mapApplication,
  parseDate,
  type ApplicationRow,
  type MappedEvent,
  type ScopeSide,
} from "@/lib/sync/passes";
import { syncRoster } from "@/lib/sync/roster";
import { advanceWatermark, windowFor } from "@/lib/sync/watermark";
import { syncOfficeTree } from "@/lib/org/office-tree";
import { currentWindow, termStart } from "@/lib/term";

// Measured against GIS: 100 applications with every stage date and the EP's
// managers answer in about 2s, 200 in 2.5-5s against a 15s client timeout.
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const PEOPLE_PAGE_SIZE = 200;
const PEOPLE_BATCH_SIZE = 200;

export const APPLICATIONS_PASS = "applications";

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

/** EP id to who manages them in EXPA, as the scans below find it (D-74). */
type ManagersByEp = Map<string, Set<string>>;

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

function scopeFilter(side: ScopeSide, officeId: bigint) {
  return side === "PERSON"
    ? { person_home_mc: [Number(officeId)] }
    : { opportunity_home_mc: [Number(officeId)] };
}

/**
 * Pages newest last action first and stops at the first row older than
 * `since` (D-76). GIS has no filter on `updated_at` it documents, but it sorts
 * on it, and a sorted read that stops is the same set.
 */
async function scanApplications(
  side: ScopeSide,
  officeId: bigint,
  programmes: number[],
  since: Date,
  visit: (row: ApplicationRow) => Promise<void>
): Promise<number> {
  let seen = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await gis().Applications({
      filters: { programmes, ...scopeFilter(side, officeId), sort: "updated_at", sort_direction: "desc" },
      pagination: { page, per_page: PAGE_SIZE },
    });
    const body = result.allOpportunityApplication;

    for (const row of body?.data ?? []) {
      if (!row) continue;
      const updatedAt = parseDate(row.updated_at);
      if (updatedAt && updatedAt < since) return seen;
      seen += 1;
      await visit(row);
    }

    if (page >= (body?.paging?.total_pages ?? 0)) return seen;
  }

  throw new Error(`Applications pass hit the ${MAX_PAGES}-page ceiling before reaching ${since.toISOString()}`);
}

function remember(managers: ManagersByEp, epPersonId: string | null | undefined, ids: bigint[] | null): void {
  // Null is "GIS did not say", which must not read as "nobody manages them".
  if (!epPersonId || ids === null) return;
  managers.set(epPersonId, new Set(ids.map(String)));
}

async function writeApplication(events: readonly MappedEvent[], applicationId: bigint, status: string | null) {
  for (const event of events) {
    const data: Prisma.ExchangeEventUncheckedCreateInput = { ...event };
    await db.exchangeEvent.upsert({
      where: { applicationId_eventType: { applicationId: event.applicationId, eventType: event.eventType } },
      create: data,
      update: data,
    });
  }
  // Every event of the application carries its status, including ones this
  // row no longer dates (D-76) -- that is what makes a withdrawal net the APL.
  await db.exchangeEvent.updateMany({ where: { applicationId }, data: { applicationStatus: status } });
}

/**
 * The EP data pass (D-76): one read of applications by last action replaces a
 * pass per stage date and the status refresh. An application whose last action
 * is newer than the watermark has its every stage date, break and status
 * written; anything that happened to it moved that timestamp.
 *
 * The same read goes back further, to the current window's start, only to
 * collect who manages each EP in EXPA, because the managers mirrored for the
 * console have to cover everyone it lists and not just who changed today.
 */
async function runApplicationsPass(now: Date, managers: ManagersByEp): Promise<PassResult> {
  const scope = await resolveScope();
  const officeId = mcOfficeId();
  const [{ from }, floor, window] = await Promise.all([
    windowFor(APPLICATIONS_PASS, now),
    termStart(),
    currentWindow(),
  ]);
  const scanFrom = from < window.startsAt ? from : window.startsAt;
  const programmes = [...scope.allowedProgrammeIds];

  const run = await db.syncRun.create({ data: { pass: APPLICATIONS_PASS, status: "RUNNING" } });

  let rowsSeen = 0;
  let rowsSkipped = 0;
  let eventsWritten = 0;

  try {
    for (const side of scope.sides) {
      rowsSeen += await scanApplications(side, officeId, programmes, scanFrom, async (row) => {
        if (side === "PERSON") {
          remember(managers, row.person?.id, row.person?.managers ? managerIds(row.person.managers) : null);
        }

        const updatedAt = parseDate(row.updated_at);
        if (updatedAt && updatedAt < from) return;

        const applicationId = row.id ? BigInt(row.id) : null;
        const events = mapApplication(row, { side, allowedProgrammeIds: scope.allowedProgrammeIds });
        if (!applicationId || events.length === 0) {
          rowsSkipped += 1;
          if (applicationId) {
            await db.exchangeEvent.updateMany({ where: { applicationId }, data: { applicationStatus: row.status ?? null } });
          }
          return;
        }

        // Nothing before the term start is held (D-43, D-58): an application
        // updated this term keeps only the stage changes this term saw.
        const kept = events.filter((event) => event.occurredAt >= floor);
        await writeApplication(kept, applicationId, row.status ?? null);
        eventsWritten += kept.length;
      });
    }

    // Only now, with every page of every side read: a watermark advanced on a
    // partial pass would silently skip whatever was missed.
    await advanceWatermark(APPLICATIONS_PASS, now);
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), eventsSeen: eventsWritten },
    });

    return { pass: APPLICATIONS_PASS, rowsSeen, eventsWritten, rowsSkipped, status: "SUCCESS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Applications pass failed", { error });
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), eventsSeen: eventsWritten, error: message },
    });
    return { pass: APPLICATIONS_PASS, rowsSeen, eventsWritten, rowsSkipped, status: "FAILED", error: message };
  }
}

/**
 * Mirrors who manages each EP in EXPA into the register (D-74): everyone the
 * console lists -- updated since the current window opened, read by last
 * action -- plus by id any EP who can score whose record has not moved since
 * then. Only EPs actually read are reconciled, so a failed read takes nobody's
 * credit away.
 */
async function runManagersPass(managers: ManagersByEp): Promise<PassResult> {
  const run = await db.syncRun.create({ data: { pass: "managers", status: "RUNNING" } });
  let rowsSeen = 0;

  try {
    const { startsAt: listedFrom } = await currentWindow();

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await gis().EpManagers({
        filters: { home_committee: [Number(mcOfficeId())], sort: "updated_at", sort_direction: "desc" },
        pagination: { page, per_page: PEOPLE_PAGE_SIZE },
      });
      let reachedFloor = false;
      for (const person of result.people?.data ?? []) {
        if (!person) continue;
        const updatedAt = parseDate(person.updated_at);
        if (updatedAt && updatedAt < listedFrom) {
          reachedFloor = true;
          break;
        }
        rowsSeen += 1;
        remember(managers, person.id, person.managers ? managerIds(person.managers) : null);
      }
      if (reachedFloor || page >= (result.people?.paging?.total_pages ?? 0)) break;
    }

    const floor = await termStart();
    const scorable = await db.exchangeEvent.findMany({
      where: { occurredAt: { gte: floor } },
      select: { epPersonId: true },
      distinct: ["epPersonId"],
    });
    const unseen = scorable.map((row) => String(row.epPersonId)).filter((id) => !managers.has(id));

    for (let index = 0; index < unseen.length; index += PEOPLE_BATCH_SIZE) {
      const batch = unseen.slice(index, index + PEOPLE_BATCH_SIZE);
      const result = await gis().EpManagers({
        filters: { ids: batch },
        pagination: { page: 1, per_page: batch.length },
      });
      for (const person of result.people?.data ?? []) {
        if (!person) continue;
        rowsSeen += 1;
        remember(managers, person.id, person.managers ? managerIds(person.managers) : null);
      }
    }

    const changes = await applySource("EXPA", managers);
    const changed = changes.created + changes.flagged + changes.cleared + changes.dropped;

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), eventsSeen: changed },
    });
    return { pass: "managers", rowsSeen, eventsWritten: changed, rowsSkipped: 0, status: "SUCCESS" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Managers pass failed", { error });
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
    return { pass: "managers", rowsSeen, eventsWritten: 0, rowsSkipped: 0, status: "FAILED", error: message };
  }
}

/**
 * The MC sign-up sheet's EP managers, credited after every sync (D-80) so a new
 * sign-up does not wait for an admin to press Import. A sheet that cannot be
 * read is an issue for the console, not a failed sync.
 */
async function runSheetPass(): Promise<PassResult> {
  try {
    const result = await importAssignments(SYSTEM_ACTOR, { dryRun: false });
    return {
      pass: "sheets",
      rowsSeen: result.epsListed,
      eventsWritten: result.assignmentsWritten,
      rowsSkipped: result.epsListed - result.epsMatched - result.epsUnassigned,
      status: "SUCCESS",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Sheet import failed during sync", { error });
    return { pass: "sheets", rowsSeen: 0, eventsWritten: 0, rowsSkipped: 0, status: "FAILED", error: message };
  }
}

/** The EP data: applications, then who manages each EP, then the sheets. */
export async function runEventPasses(now = new Date()): Promise<PassResult[]> {
  const managers: ManagersByEp = new Map();
  return [
    await runApplicationsPass(now, managers),
    await runManagersPass(managers),
    await runSheetPass(),
  ];
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

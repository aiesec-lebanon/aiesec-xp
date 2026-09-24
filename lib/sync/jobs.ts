import "server-only";

import type { SyncJob } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { replay } from "@/lib/scoring/replay";
import {
  decideRun,
  LEASE_MS,
  type SkipReason,
  type SyncJobName,
  type SyncTrigger,
} from "@/lib/sync/cadence";
import { runEventPasses, runMemberPasses, type PassResult } from "@/lib/sync/run";

// The one way a sync job runs (D-66), whoever asked for it: a GitHub schedule
// through /api/cron/*, or an admin's button. A single entry point is what lets
// the lease promise that a job never runs twice at once.

export type JobRun =
  | { outcome: "ran"; ok: boolean; steps: PassResult[]; durationMs: number }
  | { outcome: "skipped"; reason: SkipReason };

const SYSTEM_ACTOR = 0n;
const MAX_ERROR_LENGTH = 500;

async function rebuildLedger(actorId: bigint): Promise<PassResult> {
  try {
    const { ledgerEntries } = await replay(actorId);
    return {
      pass: "replay",
      rowsSeen: ledgerEntries,
      eventsWritten: ledgerEntries,
      rowsSkipped: 0,
      status: "SUCCESS",
    };
  } catch (error) {
    logger.error("Ledger rebuild failed after sync", { error });
    const message = error instanceof Error ? error.message : String(error);
    return { pass: "replay", rowsSeen: 0, eventsWritten: 0, rowsSkipped: 0, status: "FAILED", error: message };
  }
}

const WORK: Record<SyncJobName, (now: Date, actorId: bigint) => Promise<PassResult[]>> = {
  // Rebuilt from whatever the passes left behind, so a new event is scored in
  // the same run that ingested it.
  events: async (now, actorId) => [...(await runEventPasses(now)), await rebuildLedger(actorId)],
  roster: () => runMemberPasses(),
};

export async function hackathonUntil(): Promise<Date | null> {
  const settings = await db.syncSettings.findUnique({ where: { id: "singleton" } });
  return settings?.hackathonUntil ?? null;
}

export async function setHackathonUntil(until: Date | null): Promise<void> {
  await db.syncSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", hackathonUntil: until },
    update: { hackathonUntil: until },
  });
}

export async function syncJobState(job: SyncJobName): Promise<SyncJob | null> {
  return db.syncJob.findUnique({ where: { name: job } });
}

/** One UPDATE guarded on the lease, so two callers racing for it cannot both win. */
async function acquireLease(job: SyncJobName, trigger: SyncTrigger, now: Date): Promise<boolean> {
  await db.syncJob.createMany({ data: [{ name: job }], skipDuplicates: true });

  const { count } = await db.syncJob.updateMany({
    where: { name: job, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: {
      leaseUntil: new Date(now.getTime() + LEASE_MS),
      lastStartedAt: now,
      lastTrigger: trigger,
      lastStatus: "RUNNING",
    },
  });
  return count === 1;
}

/**
 * Runs a job if its trigger says it is due and nobody else is running it.
 * `actorId` is recorded against the ledger rebuild, so a replay an admin asked
 * for is audited as theirs rather than the system's.
 */
export async function runSyncJob(
  job: SyncJobName,
  trigger: SyncTrigger,
  actorId: bigint = SYSTEM_ACTOR
): Promise<JobRun> {
  const now = new Date();
  const [state, until] = await Promise.all([
    syncJobState(job),
    trigger === "HACKATHON" ? hackathonUntil() : Promise.resolve(null),
  ]);

  const decision = decideRun({
    trigger,
    now,
    hackathonUntil: until,
    lastStartedAt: state?.lastStartedAt ?? null,
  });
  if (decision !== "run") return { outcome: "skipped", reason: decision };
  if (!(await acquireLease(job, trigger, now))) return { outcome: "skipped", reason: "running" };

  let steps: PassResult[] = [];
  let failure: string | null = null;

  try {
    steps = await WORK[job](now, actorId);
    const failed = steps.filter((step) => step.status === "FAILED");
    if (failed.length > 0) {
      failure = failed.map((step) => `${step.pass}: ${step.error ?? "failed"}`).join("; ");
    }
  } catch (error) {
    logger.error("Sync job failed", { job, error });
    failure = error instanceof Error ? error.message : String(error);
  }

  const finishedAt = new Date();
  await db.syncJob.update({
    where: { name: job },
    data: {
      leaseUntil: null,
      lastFinishedAt: finishedAt,
      lastStatus: failure ? "FAILED" : "SUCCESS",
      lastError: failure?.slice(0, MAX_ERROR_LENGTH) ?? null,
      ...(failure ? {} : { lastSucceededAt: finishedAt }),
    },
  });

  return {
    outcome: "ran",
    ok: failure === null,
    steps,
    durationMs: finishedAt.getTime() - now.getTime(),
  };
}

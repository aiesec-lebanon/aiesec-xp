// When a scheduled sync job actually runs (D-66). Pure, and free of
// "server-only", so the rules are unit tested directly
// (tests/sync-cadence.test.ts).
//
// The GitHub workflows only tick; every decision about whether a tick has work
// lives here. That is what makes hackathon mode a switch in the admin console
// rather than an edit to a workflow file.

export const SYNC_JOBS = ["events", "roster"] as const;
export type SyncJobName = (typeof SYNC_JOBS)[number];

/** Mirrors the SyncTrigger enum in the schema. */
export type SyncTrigger = "HACKATHON" | "SCHEDULE" | "MANUAL";

export type SkipReason = "hackathon-off" | "ran-recently" | "running";

/**
 * A scheduled tick this close to the previous start is a duplicate: two
 * schedules landing together, or a tick right after an admin's refresh. Short
 * enough that GitHub's jitter never swallows a genuine five-minute tick.
 */
export const MIN_GAP_MS = 2 * 60 * 1000;

/**
 * GitHub documents that a scheduled run can be dropped under load, so the
 * five-minute tick also stands in for a daily run nobody attempted.
 */
export const CATCH_UP_AFTER_MS = 26 * 60 * 60 * 1000;

/** Longer than any run can live: the cron routes and the admin pages cap at 300s. */
export const LEASE_MS = 6 * 60 * 1000;

export const HACKATHON_HOURS = [12, 24, 48, 72, 168] as const;
export const DEFAULT_HACKATHON_HOURS = 48;

/** How stale a job's last success may be before the admin console calls it behind: its cadence plus slack. */
const OVERDUE_AFTER_MS: Record<SyncJobName, number> = {
  events: CATCH_UP_AFTER_MS,
  roster: 32 * 24 * 60 * 60 * 1000,
};

export function isHackathonOn(until: Date | null, now: Date): boolean {
  return until !== null && until.getTime() > now.getTime();
}

/**
 * True when a job has never succeeded or has fallen behind its schedule --
 * which is how GitHub pausing a workflow after 60 days without a commit
 * shows up, since nothing else announces it.
 */
export function isOverdue(job: SyncJobName, lastSucceededAt: Date | null, now: Date): boolean {
  if (!lastSucceededAt) return true;
  return now.getTime() - lastSucceededAt.getTime() > OVERDUE_AFTER_MS[job];
}

export type RunDecision = "run" | Exclude<SkipReason, "running">;

export function decideRun({
  trigger,
  now,
  hackathonUntil,
  lastStartedAt,
}: {
  trigger: SyncTrigger;
  now: Date;
  hackathonUntil: Date | null;
  lastStartedAt: Date | null;
}): RunDecision {
  // An admin pressing a button always gets fresh data.
  if (trigger === "MANUAL") return "run";

  const sinceLastStart = lastStartedAt ? now.getTime() - lastStartedAt.getTime() : Infinity;
  if (sinceLastStart < MIN_GAP_MS) return "ran-recently";

  if (trigger === "SCHEDULE" || isHackathonOn(hackathonUntil, now)) return "run";

  // Keyed on the last attempt, not the last success: a job that keeps failing
  // is retried by the daily run, not every five minutes.
  return sinceLastStart > CATCH_UP_AFTER_MS ? "run" : "hackathon-off";
}

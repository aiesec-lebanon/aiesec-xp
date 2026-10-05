export const SYNC_JOBS = ["events", "roster"] as const;
export type SyncJobName = (typeof SYNC_JOBS)[number];

// Mirrors the SyncTrigger enum in the schema.
export type SyncTrigger = "HACKATHON" | "SCHEDULE" | "MANUAL";

export type SkipReason = "hackathon-off" | "ran-recently" | "running";

// Short enough that GitHub's schedule jitter never swallows a genuine five-minute tick.
export const MIN_GAP_MS = 2 * 60 * 1000;

// GitHub can drop scheduled runs under load, so the frequent tick also covers a missed daily run.
export const CATCH_UP_AFTER_MS = 26 * 60 * 60 * 1000;

// Longer than any run can live: the cron routes and admin pages cap at 300s.
export const LEASE_MS = 6 * 60 * 1000;

export const HACKATHON_HOURS = [12, 24, 48, 72, 168] as const;
export const DEFAULT_HACKATHON_HOURS = 48;

const OVERDUE_AFTER_MS: Record<SyncJobName, number> = {
  events: CATCH_UP_AFTER_MS,
  roster: 32 * 24 * 60 * 60 * 1000,
};

export function isHackathonOn(until: Date | null, now: Date): boolean {
  return until !== null && until.getTime() > now.getTime();
}

// This is the only signal that GitHub silently paused a workflow after 60 days without a commit.
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
  if (trigger === "MANUAL") return "run";

  const sinceLastStart = lastStartedAt ? now.getTime() - lastStartedAt.getTime() : Infinity;
  if (sinceLastStart < MIN_GAP_MS) return "ran-recently";

  if (trigger === "SCHEDULE" || isHackathonOn(hackathonUntil, now)) return "run";

  // Keyed on the last attempt, not success, so a failing job retries daily, not every tick.
  return sinceLastStart > CATCH_UP_AFTER_MS ? "run" : "hackathon-off";
}

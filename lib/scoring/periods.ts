import { toDateInputValue } from "@/lib/admin/window";
import type { ConfigAt, ScoringConfig } from "@/lib/scoring/engine";

export type WeightPeriod = {
  startsAt: Date;
  endsAt: Date | null;
  // The newest saved period wins where periods overlap.
  savedAt: Date;
  config: ScoringConfig;
};

function covers(period: WeightPeriod, at: Date): boolean {
  return period.startsAt <= at && (period.endsAt === null || at <= period.endsAt);
}

// Newest saved covering period, else (in a gap) the latest one started before. Before every
// period falls back to the earliest, so callers never have to handle "no weights".
export function weightsAt(periods: readonly WeightPeriod[]): ConfigAt {
  if (periods.length === 0) throw new Error("No scoring periods to take weights from");

  const newestSaved = [...periods].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
  const latestStarted = [...periods].sort(
    (a, b) => b.startsAt.getTime() - a.startsAt.getTime() || b.savedAt.getTime() - a.savedAt.getTime()
  );
  const earliest = latestStarted[latestStarted.length - 1]!;

  return (at) =>
    (
      newestSaved.find((period) => covers(period, at)) ??
      latestStarted.find((period) => period.startsAt <= at) ??
      earliest
    ).config;
}

export type WeightSegment = { startDate: string; endDate: string; config: ScoringConfig };

const DAY_MS = 24 * 60 * 60 * 1000;

// For the analytics API, which only returns totals between dates. Periods sit on UTC day
// boundaries, so a day never needs two sets of weights.
export function weightSegments(range: { startsAt: Date; endsAt: Date }, configAt: ConfigAt): WeightSegment[] {
  const first = Date.UTC(range.startsAt.getUTCFullYear(), range.startsAt.getUTCMonth(), range.startsAt.getUTCDate());
  const segments: WeightSegment[] = [];

  for (let day = first; day <= range.endsAt.getTime(); day += DAY_MS) {
    const date = new Date(day);
    const config = configAt(date);
    const last = segments[segments.length - 1];
    if (last && last.config.version === config.version) {
      last.endDate = toDateInputValue(date);
    } else {
      segments.push({ startDate: toDateInputValue(date), endDate: toDateInputValue(date), config });
    }
  }

  return segments;
}

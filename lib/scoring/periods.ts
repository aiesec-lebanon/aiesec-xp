import { toDateInputValue } from "@/lib/admin/window";
import type { ConfigAt, ScoringConfig } from "@/lib/scoring/engine";

// Which weights a moment is scored with (D-85). Pure, like the engine, so the
// precedence rules are tested directly (tests/scoring-periods.test.ts).

/** A scoring period (DisplayWindow) and the weights it was given. */
export type WeightPeriod = {
  startsAt: Date;
  endsAt: Date | null;
  /** When the period was saved; the newest saved period wins where they overlap. */
  savedAt: Date;
  config: ScoringConfig;
};

function covers(period: WeightPeriod, at: Date): boolean {
  return period.startsAt <= at && (period.endsAt === null || at <= period.endsAt);
}

/**
 * The weights for any moment: those of the most recently saved period that
 * covers it, else, in a gap, those of the period that started most recently
 * before it.
 *
 * A moment before every period falls back to the earliest one. Nothing scored
 * reaches that branch -- the term start floors every range (D-58) and the
 * first period starts before it -- but a resolver that could return nothing
 * would make every caller handle a case that does not occur.
 */
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

/**
 * Splits a range into runs of whole UTC days scored with the same weights, for
 * a source that can only be asked for totals between two dates (the AIESEC
 * analytics API, D-56). Periods start and end on UTC day boundaries, so a day
 * never needs two sets of weights.
 */
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

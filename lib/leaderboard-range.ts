// Turns two query-string dates into the range a leaderboard is scored over
// (D-58). Pure, and deliberately free of "server-only" and any db import, so it
// can be unit tested directly -- the same reason lib/admin/window.ts is.

import { toDateInputValue } from "@/lib/admin/window";

export type DateRange = { startsAt: Date; endsAt: Date };

export type ResolvedRange = DateRange & {
  /** What the date inputs show. Always the range actually used, never what was
   * asked for, so a clamped request is visible rather than silent. */
  from: string;
  to: string;
  /** The earliest selectable date, for the inputs' `min`. */
  floor: string;
  /** Today, for the inputs' `max`. */
  ceiling: string;
  /** True when this is the untouched term-start-to-today default. */
  isDefault: boolean;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parse(value: string | undefined): Date | null {
  if (!value || !DATE_ONLY.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clamp(value: Date, low: Date, high: Date): Date {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

function endOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

/**
 * Resolves `?from=&to=` against the term start.
 *
 * Bad input is clamped into range rather than rejected, because the only thing
 * a leaderboard can usefully do with an impossible date is show a possible one.
 * Every bound is echoed back in `from` / `to`, so what the inputs display is
 * always what was scored.
 */
export function resolveRange(
  params: { from?: string; to?: string },
  termStart: Date,
  now: Date = new Date()
): ResolvedRange {
  const floor = startOfDay(termStart);
  const ceiling = startOfDay(now);

  // A term configured into the future would otherwise produce a range that ends
  // before it begins.
  const latest = ceiling < floor ? floor : ceiling;

  const requestedFrom = parse(params.from);
  const requestedTo = parse(params.to);

  const from = requestedFrom ? clamp(requestedFrom, floor, latest) : floor;
  const to = requestedTo ? clamp(requestedTo, from, latest) : latest;

  return {
    startsAt: from,
    endsAt: endOfDay(to),
    from: toDateInputValue(from),
    to: toDateInputValue(to),
    floor: toDateInputValue(floor),
    ceiling: toDateInputValue(latest),
    isDefault: requestedFrom === null && requestedTo === null,
  };
}

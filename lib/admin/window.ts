// Pure date math, deliberately free of "server-only" and any db import so it
// can be unit tested directly (tests/admin-window-default.test.ts) without
// dragging in a database connection.

export type WindowRange = { startsAt: Date; endsAt: Date };

/** The current calendar month, UTC, 1st 00:00:00 to the last day 23:59:59.999.
 * What the admin's window screen shows before an active DisplayWindow exists;
 * the scoring and sync paths (lib/scoring/replay.ts, lib/sync/watermark.ts)
 * keep requiring an explicit one, since D-43 floors collection at it and an
 * implicit one there would start a sync nobody asked for. */
export function defaultWindowRange(reference: Date = new Date()): WindowRange {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  return {
    startsAt: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    endsAt: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

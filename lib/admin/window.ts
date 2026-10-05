export type WindowRange = { startsAt: Date; endsAt: Date };

// UI default only; scoring still requires an explicit active window.
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

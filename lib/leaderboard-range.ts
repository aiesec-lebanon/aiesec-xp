import { toDateInputValue } from "@/lib/admin/window";

export type DateRange = { startsAt: Date; endsAt: Date };

export type ResolvedRange = DateRange & {
  // The range actually used, not what was asked for, so a clamped request is visible.
  from: string;
  to: string;
  floor: string;
  ceiling: string;
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

export function resolveRange(
  params: { from?: string; to?: string },
  termStart: Date,
  now: Date = new Date()
): ResolvedRange {
  const floor = startOfDay(termStart);
  const ceiling = startOfDay(now);

  // A term configured in the future would otherwise end before it begins.
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

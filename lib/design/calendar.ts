// Month arithmetic for the date field's own calendar. Pure and UTC-only: every
// date in this product is a YYYY-MM-DD string with no time in it, and reading
// one back in the browser's zone would shift it a day for anyone west of UTC.
//
// ISO date strings compare lexicographically, so the bounds checks below are
// plain string comparisons rather than parsed dates.

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const SHORT_MONTHS = MONTHS.map((month) => month.slice(0, 3));

/** Monday first: this is an AIESEC office in Lebanon, not a US locale. */
export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export type YearMonth = { year: number; month: number };

export type DayCell = {
  iso: string;
  day: number;
  /** False for the leading and trailing days borrowed from the months either side. */
  inMonth: boolean;
};

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Null for anything that is not a real YYYY-MM-DD date, including 2026-02-30. */
export function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return toIso(date) === value ? date : null;
}

export function monthOf(iso: string, fallback: Date = new Date()): YearMonth {
  const date = parseIso(iso) ?? fallback;
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const shifted = new Date(Date.UTC(year, month + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTHS[month]} ${year}`;
}

/**
 * Always 42 cells, six rows of seven.
 *
 * A month that needs only five rows still gets six, because a calendar that
 * changes height as you page through it moves the buttons out from under the
 * pointer that is paging.
 */
export function monthGrid({ year, month }: YearMonth): DayCell[] {
  const first = new Date(Date.UTC(year, month, 1));
  // getUTCDay is Sunday-based; this rotates it onto a Monday-based week.
  const lead = (first.getUTCDay() + 6) % 7;

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, 1 - lead + index));
    return {
      iso: toIso(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month,
    };
  });
}

/** Whatever the field shows when it is closed: "1 Aug 2026". */
export function formatDisplay(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso;
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** The long form, for the label a screen reader reads off a day button. */
export function formatFull(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  if (!date) return iso;
  return toIso(new Date(date.getTime() + days * 86_400_000));
}

export function clampIso(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

export function isWithin(iso: string, min: string, max: string): boolean {
  return iso >= min && iso <= max;
}

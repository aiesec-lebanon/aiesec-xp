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

export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export type YearMonth = { year: number; month: number };

export type DayCell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

// UTC-only: dates are bare YYYY-MM-DD strings, and the browser's zone would shift them a day.
export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The round-trip rejects dates like 2026-02-30 that Date silently rolls over.
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

// Always six rows, so the buttons don't move out from under the pointer while paging.
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

export function formatDisplay(iso: string): string {
  const date = parseIso(iso);
  if (!date) return iso;
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

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

// ISO date strings compare lexicographically.
export function clampIso(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

export function isWithin(iso: string, min: string, max: string): boolean {
  return iso >= min && iso <= max;
}

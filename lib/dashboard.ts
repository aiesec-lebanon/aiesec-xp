import "server-only";

import { db } from "@/lib/db";
import type { DateRange } from "@/lib/leaderboard-range";
import { individualStandings, type PersonalProgress } from "@/lib/leaderboard";

const DAY = 24 * 60 * 60 * 1000;

export type ActiveWindow = {
  label: string;
  startsAt: Date;
  endsAt: Date | null;
  daysLeft: number | null;
  weeksLeft: number | null;
};

export async function activeWindow(): Promise<ActiveWindow | null> {
  const window = await db.displayWindow.findFirst({ where: { isActive: true } });
  if (!window) return null;

  const remaining = window.endsAt ? window.endsAt.getTime() - Date.now() : null;

  return {
    label: window.label,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    daysLeft: remaining === null ? null : Math.max(0, Math.ceil(remaining / DAY)),
    weeksLeft: remaining === null ? null : Math.max(0, remaining / (7 * DAY)),
  };
}

export type Pace = {
  reward: PersonalProgress["rewards"][number];
  remaining: number;
  perWeek: number | null;
};

// Deliberately conservative: an open-ended or closed window yields no rate rather than a misleading one.
export function pace(progress: PersonalProgress, window: ActiveWindow | null): Pace | null {
  const reward = progress.rewards.find((candidate) => !candidate.earned);
  if (!reward) return null;

  const remaining = Math.max(0, reward.threshold - reward.current);
  const weeks = window?.weeksLeft ?? null;

  return {
    reward,
    remaining,
    perWeek: weeks === null || weeks < 1 / 7 ? null : Math.ceil(remaining / weeks),
  };
}

// Read from config because point values are admin-editable. Product multipliers are
// left out on purpose: they vary per EP, and the base weight is the guarantee.
export async function closingMove(gap: number): Promise<string | null> {
  if (gap <= 0) return null;

  const config = await db.scoreConfig.findFirst({ where: { isActive: true } });
  if (!config) return null;

  const options = [
    { label: "application", points: Number(config.aplPoints) },
    { label: "approval", points: Number(config.apdPoints) },
    { label: "realization", points: Number(config.rePoints) },
  ]
    .filter((option) => option.points > 0)
    .sort((a, b) => a.points - b.points);

  const enough = options.find((option) => option.points >= gap);
  if (enough) return `one ${enough.label} to catch up`;

  const best = options.at(-1);
  if (!best) return null;

  const needed = Math.ceil(gap / best.points);
  return `${needed} ${best.label}${needed === 1 ? "" : "s"} to catch up`;
}

export type Week = { label: string; startsAt: Date; points: number };

// Empty weeks are kept: dropping them would redraw a gap as continuous work.
export function weeklyPoints(
  trail: PersonalProgress["trail"],
  window: ActiveWindow | null,
  maxWeeks = 8
): Week[] {
  if (trail.length === 0) return [];

  const last = window?.endsAt && window.endsAt.getTime() < Date.now() ? window.endsAt : new Date();
  const earliest = trail.reduce(
    (found, entry) => (entry.occurredAt < found ? entry.occurredAt : found),
    trail[0]!.occurredAt
  );

  const firstShown = Math.max(
    earliest.getTime(),
    window?.startsAt.getTime() ?? earliest.getTime(),
    last.getTime() - maxWeeks * 7 * DAY
  );

  const weeks: Week[] = [];
  for (let start = firstShown; start <= last.getTime(); start += 7 * DAY) {
    const startsAt = new Date(start);
    weeks.push({
      label: `${startsAt.getUTCDate()}/${startsAt.getUTCMonth() + 1}`,
      startsAt,
      points: 0,
    });
  }

  for (const entry of trail) {
    const index = Math.floor((entry.occurredAt.getTime() - firstShown) / (7 * DAY));
    const week = weeks[index];
    if (week) week.points = Math.round((week.points + entry.points) * 10_000) / 10_000;
  }

  return weeks;
}

export async function topMembers(count: number, range: DateRange) {
  return (await individualStandings(range))
    .filter((standing) => standing.points > 0)
    .slice(0, count);
}

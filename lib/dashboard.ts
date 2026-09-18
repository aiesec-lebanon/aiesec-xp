import "server-only";

import { db } from "@/lib/db";
import type { DateRange } from "@/lib/leaderboard-range";
import { individualStandings, type PersonalProgress } from "@/lib/leaderboard";

// What the member-facing screens need on top of the rankings: the window they
// are being measured in, the weekly shape of their own points, and the pace that
// turns a closing date into a this-week number.
//
// Nothing here scores anything. The engine decides points; this reads the ledger
// the engine produced and answers questions about time.

const DAY = 24 * 60 * 60 * 1000;

export type ActiveWindow = {
  label: string;
  startsAt: Date;
  endsAt: Date | null;
  /** Null where the window has no end, which is a window that never closes. */
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
  /** How many more per week to arrive before the window closes. */
  perWeek: number | null;
};

/**
 * The next reward still ahead of this member, and what it costs per week.
 *
 * The highest-leverage element on the page, so it is deliberately conservative:
 * a window with no end, or one already closed, produces no rate rather than a
 * number that reads as achievable when nothing is.
 */
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

/**
 * The smallest single scored event that would close a points gap.
 *
 * The comp writes "one approval closes it" as copy. It is read here from the
 * active `ScoreConfig` instead, because a member who acts on a promise the
 * scoring rules do not keep stops believing the rest of the page -- and the
 * point values are admin-editable (D-15), so the sentence cannot be a constant.
 * Product multipliers are deliberately not applied: they vary per EP, and the
 * base weight is the guarantee.
 */
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
  if (enough) return `one ${enough.label} closes it`;

  const best = options.at(-1);
  if (!best) return null;

  const needed = Math.ceil(gap / best.points);
  return `${needed} ${best.label}${needed === 1 ? "" : "s"} closes it`;
}

export type Week = { label: string; startsAt: Date; points: number };

/**
 * The member's points bucketed into calendar weeks across the active window.
 *
 * Weeks with nothing in them are kept: a gap is the point of the chart, and
 * dropping empty buckets would quietly redraw a fortnight of silence as
 * continuous work.
 */
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

export type ActivityItem = {
  memberId: bigint;
  fullName: string;
  eventType: string;
  points: number;
  occurredAt: Date;
};

/**
 * The most recent scored events, for the /tv ticker.
 *
 * Names come from the member table, never from GIS or from the event: an
 * `ExchangeEvent` holds no EP name by construction (D-42), and what the ticker
 * announces is which member earned something, not who the EP was (D-44).
 */
export async function recentActivity(limit = 12): Promise<ActivityItem[]> {
  const entries = await db.scoreLedgerEntry.findMany({
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      memberId: true,
      points: true,
      occurredAt: true,
      member: { select: { fullName: true } },
      event: { select: { eventType: true } },
    },
  });

  return entries.map((entry) => ({
    memberId: entry.memberId,
    fullName: entry.member.fullName,
    eventType: entry.event.eventType,
    points: Number(entry.points),
    occurredAt: entry.occurredAt,
  }));
}

/** The top of the individual board, for /tv and the podium. */
export async function topMembers(count: number, range: DateRange) {
  return (await individualStandings(range)).slice(0, count);
}

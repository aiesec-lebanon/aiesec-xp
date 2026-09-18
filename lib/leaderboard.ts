import "server-only";

import { db } from "@/lib/db";
import { defaultWindowRange, toDateInputValue } from "@/lib/admin/window";
import { fetchEntityFunnelBreakdown, type ProductFunnelCounts } from "@/lib/analytics/aiesec-analytics";
import { PROGRAMME_IDS, sumProducts } from "@/lib/analytics/funnel-tags";
import { mcDirectEntityId, mcOfficeId } from "@/lib/env";
import { officePoints } from "@/lib/scoring/engine";

// Individual rankings read the derived ledger: no scoring happens here, the
// engine decides points and this only sorts and groups what it produced.
//
// Office/LC rankings (D-56) read AIESEC's own analytics API instead, live, on
// every request -- an office total doesn't need the per-EP attribution the
// ledger exists for, and AIESEC's own published counts are a figure nobody
// here can dispute. There is nothing to store: the same request that shows
// the board is the one that scores it.

export type Standing = {
  rank: number;
  memberId: bigint;
  fullName: string;
  officeId: bigint | null;
  officeName: string | null;
  points: number;
  aplCount: number;
  apdCount: number;
  reCount: number;
  /** Earliest moment this member reached their current points, for tie-breaks. */
  reachedAt: Date | null;
};

/**
 * D-33: points, then RE, then APD, then APL, then whoever got there first.
 *
 * Ordering is explicit rather than left to the database, because a tie shown in
 * a different order on each render reads as the leaderboard being wrong.
 */
export function rank(rows: readonly Omit<Standing, "rank">[]): Standing[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.reCount - a.reCount ||
        b.apdCount - a.apdCount ||
        b.aplCount - a.aplCount ||
        (a.reachedAt?.getTime() ?? Infinity) - (b.reachedAt?.getTime() ?? Infinity) ||
        a.fullName.localeCompare(b.fullName)
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

type LedgerRow = {
  memberId: bigint;
  points: unknown;
  countDelta: number;
  occurredAt: Date;
  event: { eventType: string };
};

function accumulate(rows: readonly LedgerRow[]) {
  const totals = new Map<
    string,
    { points: number; aplCount: number; apdCount: number; reCount: number; reachedAt: Date | null }
  >();

  for (const row of rows) {
    const key = String(row.memberId);
    const current =
      totals.get(key) ?? { points: 0, aplCount: 0, apdCount: 0, reCount: 0, reachedAt: null };

    current.points = Math.round((current.points + Number(row.points)) * 10_000) / 10_000;
    if (row.event.eventType === "APL") current.aplCount += row.countDelta;
    if (row.event.eventType.startsWith("APD")) current.apdCount += row.countDelta;
    if (row.event.eventType.startsWith("RE")) current.reCount += row.countDelta;
    if (!current.reachedAt || row.occurredAt > current.reachedAt) current.reachedAt = row.occurredAt;

    totals.set(key, current);
  }

  return totals;
}

/**
 * Individual standings, optionally for one office.
 *
 * Every eligible member appears, including those on zero: a leaderboard that
 * lists only people who have scored tells everyone else nothing about where
 * they stand, and the point of the product is that the target stays visible.
 */
export async function individualStandings(officeId?: bigint): Promise<Standing[]> {
  const [members, ledger] = await Promise.all([
    db.member.findMany({
      where: {
        positions: { some: {} },
        ...(officeId === undefined ? {} : { scoringOfficeId: officeId }),
      },
      select: {
        id: true,
        fullName: true,
        scoringOfficeId: true,
        scoringOffice: { select: { name: true } },
      },
    }),
    db.scoreLedgerEntry.findMany({
      select: {
        memberId: true,
        points: true,
        countDelta: true,
        occurredAt: true,
        event: { select: { eventType: true } },
      },
    }),
  ]);

  const totals = accumulate(ledger as LedgerRow[]);

  return rank(
    members.map((member) => {
      const total = totals.get(String(member.id));
      return {
        memberId: member.id,
        fullName: member.fullName,
        officeId: member.scoringOfficeId,
        officeName: member.scoringOffice?.name ?? null,
        points: total?.points ?? 0,
        aplCount: total?.aplCount ?? 0,
        apdCount: total?.apdCount ?? 0,
        reCount: total?.reCount ?? 0,
        reachedAt: total?.reachedAt ?? null,
      };
    })
  );
}

export type OfficeStanding = {
  rank: number;
  officeId: bigint;
  officeName: string;
  memberCount: number;
  points: number;
  aplCount: number;
  apdCount: number;
  reCount: number;
};

export type OfficeStandingsResult = {
  standings: OfficeStanding[];
  /** false when the AIESEC analytics API (or the active ScoreConfig) couldn't
   * be read -- every count and point below is then a zero placeholder, not a
   * real "nothing happened this window" read, and callers should say so. */
  analyticsOk: boolean;
};

const EMPTY_PRODUCT_COUNTS: ProductFunnelCounts = Object.fromEntries(
  PROGRAMME_IDS.map((id) => [id, { APL: 0, APD: 0, RE: 0 }])
);

async function memberCountsByOffice(): Promise<Map<string, number>> {
  const members = await db.member.findMany({
    where: { positions: { some: {} } },
    select: { scoringOfficeId: true },
  });

  const counts = new Map<string, number>();
  for (const member of members) {
    if (member.scoringOfficeId === null) continue;
    const key = String(member.scoringOfficeId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** D-11: LC ranking, with MC-direct members as an entity of their own.
 * Points and funnel counts come from AIESEC's analytics API (D-56) -- see the
 * module comment above. */
export async function officeStandings(): Promise<OfficeStandingsResult> {
  const [offices, memberCounts, config, window] = await Promise.all([
    // isMc excluded: the MC's own row is the subtree root the analytics query
    // is scoped to, so its total is always identical to the sum of the other
    // rows -- a 4th "entity" here would just repeat "all entities" (D-56).
    db.office.findMany({ where: { isOperating: true, isMc: false }, select: { id: true, name: true } }),
    memberCountsByOffice(),
    db.scoreConfig.findFirst({ where: { isActive: true } }),
    db.displayWindow.findFirst({ where: { isActive: true } }),
  ]);

  const range = window
    ? { startsAt: window.startsAt, endsAt: window.endsAt ?? new Date() }
    : defaultWindowRange();

  const breakdown = config
    ? await fetchEntityFunnelBreakdown({
        officeId: Number(mcOfficeId()),
        startDate: toDateInputValue(range.startsAt),
        endDate: toDateInputValue(range.endsAt),
        programmeIds: PROGRAMME_IDS,
      })
    : null;

  const analyticsOk = config !== null && breakdown !== null;
  const weights = config
    ? {
        aplPoints: Number(config.aplPoints),
        apdPoints: Number(config.apdPoints),
        rePoints: Number(config.rePoints),
        productWeights: config.productWeights as Record<string, number>,
        directionWeights: config.directionWeights as Record<string, number>,
      }
    : null;

  const directEntityId = mcDirectEntityId();

  const standings = offices
    .map((office) => {
      const counts = breakdown?.byOffice[String(office.id)] ?? EMPTY_PRODUCT_COUNTS;
      const totals = sumProducts(counts);

      // MC-direct's own committee (D-56): AIESEC's analytics API buckets its
      // applications under this office's own GIS id (read above), but its
      // members' positions record office 182 (D-32) -- so the row is shown
      // under 182 instead, to join with individualStandings()'s
      // scoringOfficeId grouping (used by the leading-office member group on
      // /leaderboard/lcs), while its funnel counts still come from its own key.
      const officeId = office.id === directEntityId ? mcOfficeId() : office.id;

      return {
        rank: 0,
        officeId,
        officeName: office.name,
        memberCount: memberCounts.get(String(officeId)) ?? 0,
        points: weights ? officePoints(counts, weights) : 0,
        aplCount: totals.APL,
        apdCount: totals.APD,
        reCount: totals.RE,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.reCount - a.reCount ||
        b.apdCount - a.apdCount ||
        b.aplCount - a.aplCount ||
        a.officeName.localeCompare(b.officeName)
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return { standings, analyticsOk };
}

export type PersonalProgress = {
  standing: Standing | null;
  totalMembers: number;
  /** The rank immediately above, for a concrete next target. */
  nextUp: Standing | null;
  trail: {
    eventType: string;
    occurredAt: Date;
    points: number;
    programmeId: number;
  }[];
  rewards: {
    id: string;
    label: string;
    description: string | null;
    thresholdType: string;
    threshold: number;
    current: number;
    earned: boolean;
  }[];
};

export async function personalProgress(memberId: bigint): Promise<PersonalProgress> {
  const [standings, entries, rewards, grants] = await Promise.all([
    individualStandings(),
    db.scoreLedgerEntry.findMany({
      where: { memberId },
      orderBy: { occurredAt: "desc" },
      select: {
        points: true,
        occurredAt: true,
        event: { select: { eventType: true, programmeId: true } },
      },
    }),
    db.reward.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.rewardGrant.findMany({ where: { memberId }, select: { rewardId: true } }),
  ]);

  const index = standings.findIndex((standing) => standing.memberId === memberId);
  const standing = index === -1 ? null : standings[index];
  const earned = new Set(grants.map((grant) => grant.rewardId));

  const measure = (thresholdType: string): number => {
    if (!standing) return 0;
    switch (thresholdType) {
      case "POINTS":
        return standing.points;
      case "APL_COUNT":
        return standing.aplCount;
      case "APD_COUNT":
        return standing.apdCount;
      case "RE_COUNT":
        return standing.reCount;
      default:
        return 0;
    }
  };

  return {
    standing,
    totalMembers: standings.length,
    nextUp: index > 0 ? standings[index - 1] : null,
    trail: entries.map((entry) => ({
      eventType: entry.event.eventType,
      occurredAt: entry.occurredAt,
      points: Number(entry.points),
      programmeId: entry.event.programmeId,
    })),
    rewards: rewards.map((reward) => ({
      id: reward.id,
      label: reward.label,
      description: reward.description,
      thresholdType: reward.thresholdType,
      threshold: Number(reward.threshold),
      current: measure(reward.thresholdType),
      earned: earned.has(reward.id),
    })),
  };
}

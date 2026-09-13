import "server-only";

import { db } from "@/lib/db";

// Reads the derived ledger into rankings. No scoring happens here: the engine
// decides points, this only sorts and groups what it produced.

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

/** D-11: LC ranking, with MC-direct members as an entity of their own. */
export async function officeStandings(): Promise<OfficeStanding[]> {
  const [offices, standings] = await Promise.all([
    db.office.findMany({ where: { isOperating: true }, select: { id: true, name: true } }),
    individualStandings(),
  ]);

  const byOffice = new Map<string, OfficeStanding>();
  for (const office of offices) {
    byOffice.set(String(office.id), {
      rank: 0,
      officeId: office.id,
      officeName: office.name,
      memberCount: 0,
      points: 0,
      aplCount: 0,
      apdCount: 0,
      reCount: 0,
    });
  }

  for (const standing of standings) {
    if (standing.officeId === null) continue;
    const entry = byOffice.get(String(standing.officeId));
    if (!entry) continue;

    entry.memberCount += 1;
    entry.points = Math.round((entry.points + standing.points) * 10_000) / 10_000;
    entry.aplCount += standing.aplCount;
    entry.apdCount += standing.apdCount;
    entry.reCount += standing.reCount;
  }

  return [...byOffice.values()]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.reCount - a.reCount ||
        b.apdCount - a.apdCount ||
        b.aplCount - a.aplCount ||
        a.officeName.localeCompare(b.officeName)
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
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

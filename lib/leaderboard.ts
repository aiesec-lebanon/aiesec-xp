import "server-only";

import { db } from "@/lib/db";
import { defaultWindowRange } from "@/lib/admin/window";
import { fetchEntityFunnelBreakdown, type ProductFunnelCounts } from "@/lib/analytics/aiesec-analytics";
import { PROGRAMME_IDS, sumProducts } from "@/lib/analytics/funnel-tags";
import { creditRegister } from "@/lib/assignments/register";
import { officeLabel, personName } from "@/lib/design/names";
import { mcDirectEntityId, mcOfficeId } from "@/lib/env";
import type { DateRange } from "@/lib/leaderboard-range";
import { inTermMemberWhere } from "@/lib/org/members";
import { officePoints, score } from "@/lib/scoring/engine";
import { weightSegments } from "@/lib/scoring/periods";
import { loadConfigAt } from "@/lib/scoring/weight-periods";

// Both boards are scored on the request that renders them, over whatever range
// they were asked for (D-58).
//
// Individual rankings run the same pure engine the ledger replay runs, with the
// requested range as its window. They used to read the derived ledger, which
// cannot answer a historic question at all: the replay bakes the active display
// window in, so the ledger only ever holds rows inside it. Scoring live keeps
// every rule the engine owns -- break netting (D-26), APL reversal (D-41), role
// shares (D-73) -- correct by construction, rather than re-deriving them in a
// query.
//
// Office/LC rankings (D-56) read AIESEC's own analytics API, which takes the
// same range as two dates: an office total doesn't need the per-EP attribution
// the ledger exists for, and AIESEC's own published counts are a figure nobody
// here can dispute.
//
// Both score every day with the weights of the period it fell in (D-85), so a
// change to the current period's weights never rewrites a past one.
//
// The ledger is still what rewards are granted from, and still what /me's trail
// and /tv's ticker read, because those are about the active window and nothing
// else.

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

type MemberTotals = {
  points: number;
  aplCount: number;
  apdCount: number;
  reCount: number;
  reachedAt: Date | null;
};

/**
 * The range the reward race is measured in (D-07): what /tv, the personal
 * dashboard and reward grants are all scoped to, whatever range a leaderboard
 * is being browsed over.
 */
export async function activeWindowRange(): Promise<DateRange> {
  const window = await db.displayWindow.findFirst({ where: { isActive: true } });
  if (!window) return defaultWindowRange();
  return { startsAt: window.startsAt, endsAt: window.endsAt ?? new Date() };
}

function roundCount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Runs the scoring engine over one range and totals the result per member.
 *
 * Every event of an application with activity in the range is read, not only
 * the in-range ones: the engine still scores only what falls inside the range,
 * but needs the application's other events to tell a re-approval from a break
 * (D-28).
 */
async function totalsForRange(range: DateRange): Promise<Map<string, MemberTotals>> {
  const [configAt, active, register] = await Promise.all([
    loadConfigAt(),
    db.exchangeEvent.findMany({
      where: { occurredAt: { gte: range.startsAt, lte: range.endsAt } },
      select: { applicationId: true },
      distinct: ["applicationId"],
    }),
    creditRegister(),
  ]);

  const totals = new Map<string, MemberTotals>();
  if (!configAt || active.length === 0) return totals;

  const events = await db.exchangeEvent.findMany({
    where: { applicationId: { in: active.map((row) => row.applicationId) } },
  });

  // No rewards: grants belong to the active window and are derived by the
  // replay, so evaluating them per request would be work nobody reads.
  const { ledger } = score({
    events,
    assignments: register.assignments,
    mains: register.mains,
    configAt,
    window: range,
    rewards: [],
  });

  for (const entry of ledger) {
    const key = String(entry.memberId);
    const current =
      totals.get(key) ?? { points: 0, aplCount: 0, apdCount: 0, reCount: 0, reachedAt: null };

    current.points = Math.round((current.points + entry.points) * 10_000) / 10_000;
    // A count is a share of the stage too (D-83), so it is rounded like points.
    if (entry.stage === "APL") current.aplCount = roundCount(current.aplCount + entry.countDelta);
    if (entry.stage === "APD") current.apdCount = roundCount(current.apdCount + entry.countDelta);
    if (entry.stage === "RE") current.reCount = roundCount(current.reCount + entry.countDelta);
    // The latest scored event is when the current total was reached, which is
    // what D-33 breaks a tie on.
    if (!current.reachedAt || entry.occurredAt > current.reachedAt) {
      current.reachedAt = entry.occurredAt;
    }

    totals.set(key, current);
  }

  return totals;
}

/**
 * Individual standings over a range, optionally for one office.
 *
 * Every eligible member appears, including those on zero; `/leaderboard` and
 * `/tv` drop the zeros themselves (D-84).
 */
export async function individualStandings(
  range: DateRange,
  officeId?: bigint
): Promise<Standing[]> {
  const [members, totals] = await Promise.all([
    db.member.findMany({
      where: {
        ...(await inTermMemberWhere()),
        ...(officeId === undefined ? {} : { scoringOfficeId: officeId }),
      },
      select: {
        id: true,
        fullName: true,
        scoringOfficeId: true,
        scoringOffice: { select: { name: true, isMc: true } },
      },
    }),
    totalsForRange(range),
  ]);
  const directEntityId = mcDirectEntityId();

  return rank(
    members.map((member) => {
      const total = totals.get(String(member.id));
      return {
        memberId: member.id,
        fullName: personName(member.fullName),
        officeId: member.scoringOfficeId,
        officeName: member.scoringOffice
          ? officeLabel(member.scoringOffice.name, {
              isMc: member.scoringOffice.isMc || member.scoringOfficeId === directEntityId,
            })
          : null,
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
  /** false when the AIESEC analytics API (or the scoring periods) couldn't
   * be read -- every count and point below is then a zero placeholder, not a
   * real "nothing happened this window" read, and callers should say so. */
  analyticsOk: boolean;
};

const EMPTY_PRODUCT_COUNTS: ProductFunnelCounts = Object.fromEntries(
  PROGRAMME_IDS.map((id) => [id, { APL: 0, APD: 0, RE: 0 }])
);

async function memberCountsByOffice(): Promise<Map<string, number>> {
  const members = await db.member.findMany({
    where: await inTermMemberWhere(),
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
 * module comment above. The range is the caller's, which is the whole reason
 * this board can be read over a historic window at all: the analytics endpoint
 * takes two dates and holds no opinion about which ones. */
export async function officeStandings(range: DateRange): Promise<OfficeStandingsResult> {
  const [offices, memberCounts, configAt] = await Promise.all([
    // isMc excluded: the MC's own row is the subtree root the analytics query
    // is scoped to, so its total is always identical to the sum of the other
    // rows -- a 4th "entity" here would just repeat "all entities" (D-56).
    db.office.findMany({ where: { isOperating: true, isMc: false }, select: { id: true, name: true } }),
    memberCountsByOffice(),
    loadConfigAt(),
  ]);

  // The API only returns totals between two dates, so a range spanning periods
  // with different weights is asked for one run of days at a time (D-85).
  const segments = configAt ? weightSegments(range, configAt) : [];
  const parts = await Promise.all(
    segments.map(async (segment) => {
      const breakdown = await fetchEntityFunnelBreakdown({
        officeId: Number(mcOfficeId()),
        startDate: segment.startDate,
        endDate: segment.endDate,
        programmeIds: PROGRAMME_IDS,
      });
      return breakdown ? { breakdown, config: segment.config } : null;
    })
  );

  const analyticsOk = segments.length > 0 && parts.every((part) => part !== null);
  const scored = analyticsOk ? parts.filter((part) => part !== null) : [];

  const directEntityId = mcDirectEntityId();

  const standings = offices
    .map((office) => {
      let points = 0;
      const totals = { APL: 0, APD: 0, RE: 0 };
      for (const { breakdown, config } of scored) {
        const counts = breakdown.byOffice[String(office.id)] ?? EMPTY_PRODUCT_COUNTS;
        const sum = sumProducts(counts);
        points += officePoints(counts, config);
        totals.APL += sum.APL;
        totals.APD += sum.APD;
        totals.RE += sum.RE;
      }

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
        officeName: officeLabel(office.name, { isMc: office.id === directEntityId }),
        memberCount: memberCounts.get(String(officeId)) ?? 0,
        points: Math.round(points * 10_000) / 10_000,
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
    /** The stage credited, or `<stage>_BROKEN` for a break taking it back. */
    eventType: string;
    occurredAt: Date;
    points: number;
    /** This member's part of the EP's points, 1 when nobody shares it (D-73). */
    share: number;
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

/** A ledger entry as the member-facing screens name it: the stage, or its break. */
export function trailLabel(stage: string, countDelta: number): string {
  return countDelta < 0 ? `${stage}_BROKEN` : stage;
}

/**
 * Always the active display window, never a browsed range: what this returns
 * has to agree with the `RewardGrant` rows the replay derived, and those are
 * granted against the window alone (D-07, D-34).
 */
export async function personalProgress(memberId: bigint): Promise<PersonalProgress> {
  const [standings, entries, rewards, grants] = await Promise.all([
    activeWindowRange().then((range) => individualStandings(range)),
    db.scoreLedgerEntry.findMany({
      where: { memberId },
      orderBy: { occurredAt: "desc" },
      select: {
        stage: true,
        points: true,
        share: true,
        countDelta: true,
        occurredAt: true,
        event: { select: { programmeId: true } },
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
      eventType: trailLabel(entry.stage, Number(entry.countDelta)),
      occurredAt: entry.occurredAt,
      points: Number(entry.points),
      share: Number(entry.share),
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

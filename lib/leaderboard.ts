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

// Boards are scored live per request: the ledger only holds the active window, so it
// can't answer arbitrary ranges.

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
  reachedAt: Date | null;
};

// Fully deterministic so a tie never reorders between renders.
function rank(rows: readonly Omit<Standing, "rank">[]): Standing[] {
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

export async function activeWindowRange(): Promise<DateRange> {
  const window = await db.displayWindow.findFirst({ where: { isActive: true } });
  if (!window) return defaultWindowRange();
  return { startsAt: window.startsAt, endsAt: window.endsAt ?? new Date() };
}

function roundCount(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

// Reads every event of an active application, not just in-range ones: the engine needs
// them to tell a re-approval from a break.
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

  // No rewards: grants are derived by the replay for the active window only.
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
    if (entry.stage === "APL") current.aplCount = roundCount(current.aplCount + entry.countDelta);
    if (entry.stage === "APD") current.apdCount = roundCount(current.apdCount + entry.countDelta);
    if (entry.stage === "RE") current.reCount = roundCount(current.reCount + entry.countDelta);
    // The latest scored event is when the current total was reached, used for tie-breaks.
    if (!current.reachedAt || entry.occurredAt > current.reachedAt) {
      current.reachedAt = entry.occurredAt;
    }

    totals.set(key, current);
  }

  return totals;
}

// Includes members on zero; callers filter them out.
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
  // When false, every count is a zero placeholder, not a real "nothing happened".
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

export async function officeStandings(range: DateRange): Promise<OfficeStandingsResult> {
  const [offices, memberCounts, configAt] = await Promise.all([
    // The MC row is the analytics subtree root, so its total would just repeat the sum of the rest.
    db.office.findMany({ where: { isOperating: true, isMc: false }, select: { id: true, name: true } }),
    memberCountsByOffice(),
    loadConfigAt(),
  ]);

  // The API only returns totals between two dates, so query one weight period at a time.
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

      // Analytics buckets MC-direct under its own office id, but its members' positions
      // record the MC office, so the row is keyed by the MC id to join with member standings.
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
  nextUp: Standing | null;
  trail: {
    eventType: string;
    occurredAt: Date;
    points: number;
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

function trailLabel(stage: string, countDelta: number): string {
  return countDelta < 0 ? `${stage}_BROKEN` : stage;
}

// Always the active window, never a browsed range, so it agrees with the replay's RewardGrant rows.
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

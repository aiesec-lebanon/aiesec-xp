import {
  attribute,
  indexAssignments,
  type Assignment,
  type AttributionStrategy,
  DEFAULT_CHAIN,
} from "@/lib/scoring/attribution";

// The scoring engine. Pure: no database, no network, no clock. Everything it
// needs arrives as an argument, so the same inputs always produce the same
// ledger and a replay is a function call rather than a procedure.
//
// This is the part that must never be wrong (Architecture.md 7).

export type FunnelEventType = "APL" | "APD" | "RE" | "APD_BROKEN" | "RE_BROKEN";
export type DirectionValue = "OUTGOING" | "INCOMING";

export type ScorableEvent = {
  id: string;
  applicationId: bigint;
  eventType: FunnelEventType;
  occurredAt: Date;
  epPersonId: bigint;
  programmeId: number;
  direction: DirectionValue;
  applicationStatus: string | null;
};

export type ScoringConfig = {
  version: number;
  aplPoints: number;
  apdPoints: number;
  rePoints: number;
  reverseApl: boolean;
  aplReversingStatuses: readonly string[];
  productWeights: Readonly<Record<string, number>>;
  directionWeights: Readonly<Record<string, number>>;
};

export type Window = { startsAt: Date; endsAt: Date | null };

export type ThresholdKind = "POINTS" | "APL_COUNT" | "APD_COUNT" | "RE_COUNT";

export type RewardDefinition = {
  id: string;
  thresholdType: ThresholdKind;
  threshold: number;
};

export type LedgerEntry = {
  memberId: bigint;
  exchangeEventId: string;
  configVersion: number;
  points: number;
  countDelta: number;
  occurredAt: Date;
};

export type Grant = { memberId: bigint; rewardId: string; earnedAt: Date };

export type AnomalyKindValue =
  | "UNKNOWN_PROGRAMME_WEIGHT"
  | "BREAK_WITHOUT_STAGE_EVENT"
  | "UNATTRIBUTED";

export type Anomaly = {
  exchangeEventId: string;
  kind: AnomalyKindValue;
  detail: string;
};

export type ScoreInput = {
  events: readonly ScorableEvent[];
  assignments: readonly Assignment[];
  config: ScoringConfig;
  window: Window;
  rewards: readonly RewardDefinition[];
  chain?: readonly AttributionStrategy[];
};

export type ScoreOutput = {
  ledger: LedgerEntry[];
  grants: Grant[];
  anomalies: Anomaly[];
};

const STAGE_FOR_BREAK: Partial<Record<FunnelEventType, FunnelEventType>> = {
  APD_BROKEN: "APD",
  RE_BROKEN: "RE",
};

function inWindow(occurredAt: Date, window: Window): boolean {
  if (occurredAt < window.startsAt) return false;
  return window.endsAt === null || occurredAt <= window.endsAt;
}

function basePoints(eventType: FunnelEventType, config: ScoringConfig): number {
  switch (eventType) {
    case "APL":
      return config.aplPoints;
    case "APD":
    case "APD_BROKEN":
      return config.apdPoints;
    case "RE":
    case "RE_BROKEN":
      return config.rePoints;
  }
}

function isBreak(eventType: FunnelEventType): boolean {
  return eventType === "APD_BROKEN" || eventType === "RE_BROKEN";
}

/**
 * A withdrawn or rejected application never counted, whenever that happened
 * (D-41). Evaluated against current status rather than as a dated reversal,
 * because GIS dates neither transition in a way that can be filtered.
 */
function isReversedApl(event: ScorableEvent, config: ScoringConfig): boolean {
  if (event.eventType !== "APL" || !config.reverseApl) return false;
  const status = event.applicationStatus?.trim().toLowerCase() ?? "";
  return config.aplReversingStatuses.some((value) => value.trim().toLowerCase() === status);
}

/**
 * Rounded to four places, matching the ledger column. Floating point would
 * otherwise let 0.1 + 0.2 reach a member's visible total.
 */
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function score({
  events,
  assignments,
  config,
  window,
  rewards,
  chain = DEFAULT_CHAIN,
}: ScoreInput): ScoreOutput {
  const assignmentsByEp = indexAssignments(assignments);
  const ledger: LedgerEntry[] = [];
  const anomalies: Anomaly[] = [];

  // A break scores only if the event it reverses is also inside the window
  // (D-26), so a visible score can never fall for work that was never credited.
  const stagesInWindow = new Set(
    events
      .filter((event) => !isBreak(event.eventType) && inWindow(event.occurredAt, window))
      .map((event) => `${event.applicationId}:${event.eventType}`)
  );

  for (const event of events) {
    if (!inWindow(event.occurredAt, window)) continue;

    if (isBreak(event.eventType)) {
      const stage = STAGE_FOR_BREAK[event.eventType];
      if (!stage || !stagesInWindow.has(`${event.applicationId}:${stage}`)) {
        anomalies.push({
          exchangeEventId: event.id,
          kind: "BREAK_WITHOUT_STAGE_EVENT",
          detail: `${event.eventType} has no in-window ${stage ?? "stage"} to reverse`,
        });
        continue;
      }
    }

    if (isReversedApl(event, config)) continue;

    const { memberIds } = attribute(event, { assignmentsByEp }, chain);
    if (memberIds.length === 0) {
      anomalies.push({
        exchangeEventId: event.id,
        kind: "UNATTRIBUTED",
        detail: `No assignment covers EP ${event.epPersonId} at ${event.occurredAt.toISOString()}`,
      });
      continue;
    }

    const productWeight = config.productWeights[String(event.programmeId)];
    if (productWeight === undefined) {
      // Never assumed to be 1: an invented weight is a wrong score that looks
      // right (D-30).
      anomalies.push({
        exchangeEventId: event.id,
        kind: "UNKNOWN_PROGRAMME_WEIGHT",
        detail: `Programme ${event.programmeId} has no configured weight`,
      });
      continue;
    }

    const directionWeight = config.directionWeights[event.direction] ?? 0;
    const magnitude = basePoints(event.eventType, config) * productWeight * directionWeight;
    const signed = isBreak(event.eventType) ? -magnitude : magnitude;

    // Full points to each concurrent assignee (D-06).
    for (const memberId of memberIds) {
      ledger.push({
        memberId,
        exchangeEventId: event.id,
        configVersion: config.version,
        points: round(signed),
        countDelta: isBreak(event.eventType) ? -1 : 1,
        occurredAt: event.occurredAt,
      });
    }
  }

  return { ledger, grants: evaluateRewards(ledger, events, rewards), anomalies };
}

export type OfficeFunnelCounts = Record<number, { APL: number; APD: number; RE: number }>;

/**
 * Points for a whole office's raw AIESEC-analytics funnel counts (D-56): LC
 * ranking doesn't need per-EP attribution, so this skips assignment, breaks
 * and APL reversal and applies the same base/product/direction weights
 * `score()` uses per event, directly to an aggregate count per programme.
 */
export function officePoints(
  counts: OfficeFunnelCounts,
  config: Pick<ScoringConfig, "aplPoints" | "apdPoints" | "rePoints" | "productWeights" | "directionWeights">,
  direction: DirectionValue = "OUTGOING"
): number {
  const directionWeight = config.directionWeights[direction] ?? 0;
  let points = 0;

  for (const [programmeId, stage] of Object.entries(counts)) {
    const productWeight = config.productWeights[programmeId];
    if (productWeight === undefined) continue; // D-30: unconfigured weight scores zero

    points +=
      config.aplPoints * productWeight * directionWeight * stage.APL +
      config.apdPoints * productWeight * directionWeight * stage.APD +
      config.rePoints * productWeight * directionWeight * stage.RE;
  }

  return round(points);
}

export type MemberTotals = {
  points: number;
  aplCount: number;
  apdCount: number;
  reCount: number;
};

const EMPTY_TOTALS: MemberTotals = { points: 0, aplCount: 0, apdCount: 0, reCount: 0 };

/**
 * Counts are net of breaks (D-20), which is what lets a threshold be lost again
 * rather than only reached.
 */
export function totalsByMember(
  ledger: readonly LedgerEntry[],
  events: readonly ScorableEvent[]
): Map<string, MemberTotals> {
  const typeById = new Map(events.map((event) => [event.id, event.eventType]));
  const totals = new Map<string, MemberTotals>();

  for (const entry of ledger) {
    const key = String(entry.memberId);
    const current = totals.get(key) ?? { ...EMPTY_TOTALS };
    const eventType = typeById.get(entry.exchangeEventId);

    current.points = round(current.points + entry.points);
    if (eventType === "APL") current.aplCount += entry.countDelta;
    if (eventType === "APD" || eventType === "APD_BROKEN") current.apdCount += entry.countDelta;
    if (eventType === "RE" || eventType === "RE_BROKEN") current.reCount += entry.countDelta;

    totals.set(key, current);
  }

  return totals;
}

function measure(totals: MemberTotals, kind: ThresholdKind): number {
  switch (kind) {
    case "POINTS":
      return totals.points;
    case "APL_COUNT":
      return totals.aplCount;
    case "APD_COUNT":
      return totals.apdCount;
    case "RE_COUNT":
      return totals.reCount;
  }
}

/**
 * A grant is derived, never patched: a replay that no longer supports one simply
 * does not emit it, and the caller deletes what it no longer sees (D-34).
 *
 * earnedAt is the moment the threshold was actually crossed, found by walking
 * the member's entries in order, so the date survives a replay unchanged.
 */
export function evaluateRewards(
  ledger: readonly LedgerEntry[],
  events: readonly ScorableEvent[],
  rewards: readonly RewardDefinition[]
): Grant[] {
  if (rewards.length === 0) return [];

  const byMember = new Map<string, LedgerEntry[]>();
  for (const entry of ledger) {
    const key = String(entry.memberId);
    const bucket = byMember.get(key);
    if (bucket) bucket.push(entry);
    else byMember.set(key, [entry]);
  }

  const grants: Grant[] = [];

  for (const [memberKey, entries] of byMember) {
    const finalTotals = totalsByMember(entries, events).get(memberKey) ?? EMPTY_TOTALS;

    const ordered = [...entries].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
    );

    for (const reward of rewards) {
      if (measure(finalTotals, reward.thresholdType) < reward.threshold) continue;

      let running: LedgerEntry[] = [];
      let earnedAt: Date | null = null;

      for (const entry of ordered) {
        running = [...running, entry];
        const soFar = totalsByMember(running, events).get(memberKey) ?? EMPTY_TOTALS;
        if (measure(soFar, reward.thresholdType) >= reward.threshold) {
          earnedAt = entry.occurredAt;
          break;
        }
      }

      if (earnedAt) {
        grants.push({ memberId: BigInt(memberKey), rewardId: reward.id, earnedAt });
      }
    }
  }

  return grants;
}

import { indexAssignments, type Assignment } from "@/lib/scoring/attribution";
import { creditShares, type RoleShares } from "@/lib/scoring/shares";

// The scoring engine. Pure: no database, no network, no clock. Everything it
// needs arrives as an argument, so the same inputs always produce the same
// ledger and a replay is a function call rather than a procedure.
//
// This is the part that must never be wrong (Architecture.md 7).

export type FunnelEventType = "APL" | "APD" | "RE" | "APD_BROKEN" | "RE_BROKEN";
export type ScoredStageValue = "APL" | "APD" | "RE";
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
  roleShares: RoleShares;
};

/** The weights a moment is scored with: each period keeps its own (D-85). */
export type ConfigAt = (at: Date) => ScoringConfig;

/** One set of weights for every moment. */
export function constantConfig(config: ScoringConfig): ConfigAt {
  return () => config;
}

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
  /** What the entry pays for: the event's own stage, or the stage a break takes back. */
  stage: ScoredStageValue;
  configVersion: number;
  points: number;
  /** This member's fraction of the event: 1 for the main or a sole manager, else their role's % (D-83). */
  share: number;
  /** The same fraction of the stage's count, negative on a break. */
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
  /** EP id to the main manager an admin picked, member or not (D-83). */
  mains?: ReadonlyMap<string, bigint>;
  configAt: ConfigAt;
  window: Window;
  rewards: readonly RewardDefinition[];
};

export type ScoreOutput = {
  ledger: LedgerEntry[];
  grants: Grant[];
  anomalies: Anomaly[];
};

const STAGE_OF: Partial<Record<FunnelEventType, ScoredStageValue>> = {
  APL: "APL",
  APD: "APD",
  RE: "RE",
};

const REVERSES: Partial<Record<FunnelEventType, ScoredStageValue>> = {
  APD_BROKEN: "APD",
  RE_BROKEN: "RE",
};

const STAGE_ORDER: Record<ScoredStageValue, number> = { APL: 0, APD: 1, RE: 2 };

/** `config` is the stage's own weights, which a break takes back unchanged (D-85). */
type Credit = { stage: ScoredStageValue; at: Date; source: ScorableEvent; sign: 1 | -1; config: ScoringConfig };

function inWindow(occurredAt: Date, window: Window): boolean {
  if (occurredAt < window.startsAt) return false;
  return window.endsAt === null || occurredAt <= window.endsAt;
}

function basePoints(stage: ScoredStageValue, config: ScoringConfig): number {
  switch (stage) {
    case "APL":
      return config.aplPoints;
    case "APD":
      return config.apdPoints;
    case "RE":
      return config.rePoints;
  }
}

/**
 * Rounded to four places, matching the ledger column. Floating point would
 * otherwise let 0.1 + 0.2 reach a member's visible total.
 */
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundShare(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function groupByApplication(events: readonly ScorableEvent[]): ScorableEvent[][] {
  const byApplication = new Map<string, ScorableEvent[]>();
  for (const event of events) {
    const key = String(event.applicationId);
    const bucket = byApplication.get(key);
    if (bucket) bucket.push(event);
    else byApplication.set(key, [event]);
  }
  return [...byApplication.values()];
}

/**
 * Every event of an application carries its current status. The APL row's is
 * preferred because it is the one the status refresh always kept current,
 * which matters for rows written before every event was rewritten (D-76).
 */
function applicationStatus(application: readonly ScorableEvent[]): string | null {
  const apl = application.find((event) => event.eventType === "APL" && event.applicationStatus);
  return (apl ?? application.find((event) => event.applicationStatus))?.applicationStatus ?? null;
}

/**
 * A withdrawn or rejected application never counted, whenever that happened
 * (D-41). Evaluated against current status rather than as a dated reversal,
 * because GIS dates neither transition in a way that can be filtered.
 */
function isReversedApl(status: string | null, config: ScoringConfig): boolean {
  if (!config.reverseApl) return false;
  const normalised = status?.trim().toLowerCase() ?? "";
  return config.aplReversingStatuses.some((value) => value.trim().toLowerCase() === normalised);
}

/**
 * What one application earns inside the window: each of its APL, APD and RE
 * whose own date falls inside it, and nothing else (D-75). A stage from before
 * the window earned its points in the window it happened in, so a later stage
 * does not bring it back -- and a status past realization (finished,
 * completed) is not a stage at all.
 */
function stageCredits(
  application: readonly ScorableEvent[],
  window: Window,
  configAt: ConfigAt
): Credit[] {
  const status = applicationStatus(application);

  return application
    .flatMap((event): Credit[] => {
      const stage = STAGE_OF[event.eventType];
      if (!stage || !inWindow(event.occurredAt, window)) return [];
      const config = configAt(event.occurredAt);
      if (stage === "APL" && isReversedApl(status, config)) return [];
      return [{ stage, at: event.occurredAt, source: event, sign: 1, config }];
    })
    .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]);
}

/**
 * A break inside the window takes back the stage it breaks, if that stage was
 * credited inside the window before it (D-26) -- a break of work the window
 * never paid for reduces nothing, so a visible score cannot fall for it.
 *
 * A break the stage has since overtaken is ignored (D-28): approve, break,
 * re-approve scores as approved. Sync already skips such a break at ingest;
 * this covers one ingested before the re-approval happened.
 */
function breakReversals(
  application: readonly ScorableEvent[],
  credits: readonly Credit[],
  window: Window,
  report: (event: ScorableEvent, kind: AnomalyKindValue, detail: string) => void
): Credit[] {
  const reversals: Credit[] = [];

  for (const event of application) {
    const stage = REVERSES[event.eventType];
    if (!stage || !inWindow(event.occurredAt, window)) continue;

    const overtaken = application.some(
      (other) => other.eventType === stage && other.occurredAt > event.occurredAt
    );
    if (overtaken) continue;

    const reversed = credits.find((credit) => credit.stage === stage);
    if (!reversed) {
      report(event, "BREAK_WITHOUT_STAGE_EVENT", `${event.eventType} has no in-window ${stage} to reverse`);
      continue;
    }

    reversals.push({ stage, at: event.occurredAt, source: event, sign: -1, config: reversed.config });
  }

  return reversals;
}

export function score({ events, assignments, mains = new Map(), configAt, window, rewards }: ScoreInput): ScoreOutput {
  const creditsByEp = indexAssignments(assignments);
  const ledger: LedgerEntry[] = [];
  const anomalies: Anomaly[] = [];

  const reported = new Set<string>();
  const report = (event: ScorableEvent, kind: AnomalyKindValue, detail: string) => {
    const key = `${event.id}:${kind}`;
    if (reported.has(key)) return;
    reported.add(key);
    anomalies.push({ exchangeEventId: event.id, kind, detail });
  };

  for (const application of groupByApplication(events)) {
    const gains = stageCredits(application, window, configAt);
    const credits = [...gains, ...breakReversals(application, gains, window, report)];
    if (credits.length === 0) continue;

    const { epPersonId, programmeId, direction } = application[0]!;

    const creditees = creditsByEp.get(String(epPersonId)) ?? [];
    if (creditees.length === 0) {
      for (const credit of credits) {
        report(credit.source, "UNATTRIBUTED", `Nobody is credited with EP ${epPersonId}`);
      }
      continue;
    }

    const main = mains.get(String(epPersonId)) ?? null;

    for (const credit of credits) {
      const { config } = credit;
      const productWeight = config.productWeights[String(programmeId)];
      if (productWeight === undefined) {
        // Never assumed to be 1: an invented weight is a wrong score that looks
        // right (D-30).
        report(credit.source, "UNKNOWN_PROGRAMME_WEIGHT", `Programme ${programmeId} has no configured weight`);
        continue;
      }

      const directionWeight = config.directionWeights[direction] ?? 0;
      const magnitude = basePoints(credit.stage, config) * productWeight * directionWeight;
      for (const [member, share] of creditShares(creditees, main, config.roleShares)) {
        // A role with no percentage takes nothing, and an entry for nothing
        // would only show up in a trail as a zero.
        if (share === 0) continue;
        ledger.push({
          memberId: BigInt(member),
          exchangeEventId: credit.source.id,
          stage: credit.stage,
          configVersion: config.version,
          points: round(credit.sign * magnitude * share),
          share: roundShare(share),
          countDelta: roundShare(credit.sign * share),
          occurredAt: credit.at,
        });
      }
    }
  }

  return { ledger, grants: evaluateRewards(ledger, rewards), anomalies };
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

function add(totals: MemberTotals, entry: LedgerEntry): void {
  totals.points = round(totals.points + entry.points);
  if (entry.stage === "APL") totals.aplCount = roundShare(totals.aplCount + entry.countDelta);
  if (entry.stage === "APD") totals.apdCount = roundShare(totals.apdCount + entry.countDelta);
  if (entry.stage === "RE") totals.reCount = roundShare(totals.reCount + entry.countDelta);
}

/**
 * Counts are net of breaks (D-10), which is what lets a threshold be lost again
 * rather than only reached.
 */
export function totalsByMember(ledger: readonly LedgerEntry[]): Map<string, MemberTotals> {
  const totals = new Map<string, MemberTotals>();
  for (const entry of ledger) {
    const key = String(entry.memberId);
    const current = totals.get(key) ?? { ...EMPTY_TOTALS };
    add(current, entry);
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
    const finalTotals = totalsByMember(entries).get(memberKey) ?? EMPTY_TOTALS;
    const ordered = [...entries].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    for (const reward of rewards) {
      if (measure(finalTotals, reward.thresholdType) < reward.threshold) continue;

      const running = { ...EMPTY_TOTALS };
      for (const entry of ordered) {
        add(running, entry);
        if (measure(running, reward.thresholdType) >= reward.threshold) {
          grants.push({ memberId: BigInt(memberKey), rewardId: reward.id, earnedAt: entry.occurredAt });
          break;
        }
      }
    }
  }

  return grants;
}

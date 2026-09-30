import "server-only";

import { db } from "@/lib/db";
import { creditRegister } from "@/lib/assignments/register";
import { logger } from "@/lib/logger";
import { toScoringConfig } from "@/lib/scoring/config";
import { score, type RewardDefinition } from "@/lib/scoring/engine";

// Rebuilds the derived tables from events, assignments and config (D-15).
//
// The ledger is never patched. A config change, an import or an override drops
// what was derived and recomputes it, which is what makes those changes safe to
// make: there is no accumulated state to get out of step.

export type ReplayResult = {
  configVersion: number;
  ledgerEntries: number;
  grants: number;
  anomalies: number;
};

export async function replay(actorId: bigint): Promise<ReplayResult> {
  const [config, window, rewards, events, register] = await Promise.all([
    db.scoreConfig.findFirst({ where: { isActive: true } }),
    db.displayWindow.findFirst({ where: { isActive: true } }),
    db.reward.findMany({ where: { isActive: true } }),
    db.exchangeEvent.findMany(),
    creditRegister(),
  ]);

  if (!config) throw new Error("No active ScoreConfig");
  if (!window) throw new Error("No active DisplayWindow");

  const definitions: RewardDefinition[] = rewards.map((reward) => ({
    id: reward.id,
    thresholdType: reward.thresholdType,
    threshold: Number(reward.threshold),
  }));

  const result = score({
    events,
    assignments: register.assignments,
    mains: register.mains,
    config: toScoringConfig(config),
    window: { startsAt: window.startsAt, endsAt: window.endsAt },
    rewards: definitions,
  });

  // One transaction: a half-rebuilt ledger would show people scores that never
  // existed.
  await db.$transaction([
    db.scoreLedgerEntry.deleteMany({}),
    db.rewardGrant.deleteMany({}),
    db.scoringAnomaly.deleteMany({}),
    db.scoreLedgerEntry.createMany({
      data: result.ledger.map((entry) => ({
        memberId: entry.memberId,
        exchangeEventId: entry.exchangeEventId,
        stage: entry.stage,
        configVersion: entry.configVersion,
        points: entry.points,
        share: entry.share,
        countDelta: entry.countDelta,
        occurredAt: entry.occurredAt,
      })),
      skipDuplicates: true,
    }),
    db.rewardGrant.createMany({ data: result.grants, skipDuplicates: true }),
    db.scoringAnomaly.createMany({
      data: result.anomalies.map((anomaly) => ({
        exchangeEventId: anomaly.exchangeEventId,
        kind: anomaly.kind,
        detail: anomaly.detail,
      })),
      skipDuplicates: true,
    }),
    db.auditLog.create({
      data: {
        actorId,
        action: "REPLAY",
        targetType: "ScoreLedgerEntry",
        targetId: `config-v${config.version}`,
        afterJson: {
          ledgerEntries: result.ledger.length,
          grants: result.grants.length,
          anomalies: result.anomalies.length,
        },
      },
    }),
  ]);

  logger.info("Ledger rebuilt", {
    configVersion: config.version,
    ledgerEntries: result.ledger.length,
    grants: result.grants.length,
    anomalies: result.anomalies.length,
  });

  return {
    configVersion: config.version,
    ledgerEntries: result.ledger.length,
    grants: result.grants.length,
    anomalies: result.anomalies.length,
  };
}

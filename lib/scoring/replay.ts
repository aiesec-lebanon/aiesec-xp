import "server-only";

import { db } from "@/lib/db";
import { creditRegister } from "@/lib/assignments/register";
import { logger } from "@/lib/logger";
import { score, type RewardDefinition } from "@/lib/scoring/engine";
import { loadConfigAt } from "@/lib/scoring/weight-periods";

// Rebuilds the derived tables from events, assignments and config (D-15).
//
// The ledger is never patched. A config change, an import or an override drops
// what was derived and recomputes it, which is what makes those changes safe to
// make: there is no accumulated state to get out of step. The ledger holds the
// active window only, and each event is scored with its own period's weights
// (D-85), so a replay never changes what a past period earned.

export type ReplayResult = {
  configVersion: number;
  ledgerEntries: number;
  grants: number;
  anomalies: number;
};

export async function replay(actorId: bigint): Promise<ReplayResult> {
  const [configAt, window, rewards, events, register] = await Promise.all([
    loadConfigAt(),
    db.displayWindow.findFirst({ where: { isActive: true }, select: { startsAt: true, endsAt: true, configVersion: true } }),
    db.reward.findMany({ where: { isActive: true } }),
    db.exchangeEvent.findMany(),
    creditRegister(),
  ]);

  if (!window || !configAt) throw new Error("No active DisplayWindow");

  const definitions: RewardDefinition[] = rewards.map((reward) => ({
    id: reward.id,
    thresholdType: reward.thresholdType,
    threshold: Number(reward.threshold),
  }));

  const result = score({
    events,
    assignments: register.assignments,
    mains: register.mains,
    configAt,
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
        targetId: `config-v${window.configVersion}`,
        afterJson: {
          ledgerEntries: result.ledger.length,
          grants: result.grants.length,
          anomalies: result.anomalies.length,
        },
      },
    }),
  ]);

  logger.info("Ledger rebuilt", {
    configVersion: window.configVersion,
    ledgerEntries: result.ledger.length,
    grants: result.grants.length,
    anomalies: result.anomalies.length,
  });

  return {
    configVersion: window.configVersion,
    ledgerEntries: result.ledger.length,
    grants: result.grants.length,
    anomalies: result.anomalies.length,
  };
}

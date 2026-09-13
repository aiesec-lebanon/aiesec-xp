// Runs the scoring engine over what is actually in the database and prints the
// result. Read-only: it writes no ledger, and exists to sanity-check the engine
// against real data before the leaderboard is built on it.
import { db } from "@/lib/db";
import { score, type ScorableEvent, type ScoringConfig } from "@/lib/scoring/engine";

const [config, window, rewards, events, assignments] = await Promise.all([
  db.scoreConfig.findFirst({ where: { isActive: true } }),
  db.displayWindow.findFirst({ where: { isActive: true } }),
  db.reward.findMany({ where: { isActive: true } }),
  db.exchangeEvent.findMany(),
  db.epAssignment.findMany(),
]);

if (!config || !window) throw new Error("No active config or display window");

const scoringConfig: ScoringConfig = {
  version: config.version,
  aplPoints: Number(config.aplPoints),
  apdPoints: Number(config.apdPoints),
  rePoints: Number(config.rePoints),
  reverseApl: config.reverseApl,
  aplReversingStatuses: config.aplReversingStatuses as string[],
  productWeights: config.productWeights as Record<string, number>,
  directionWeights: config.directionWeights as Record<string, number>,
};

const result = score({
  events: events as unknown as ScorableEvent[],
  assignments,
  config: scoringConfig,
  window: { startsAt: window.startsAt, endsAt: window.endsAt },
  rewards: rewards.map((r) => ({
    id: r.id,
    thresholdType: r.thresholdType,
    threshold: Number(r.threshold),
  })),
});

console.log(`events in database : ${events.length}`);
console.log(`assignments        : ${assignments.length}`);
console.log(`window             : ${window.startsAt.toISOString().slice(0, 10)} -> ${window.endsAt?.toISOString().slice(0, 10) ?? "open"}`);
console.log(`ledger entries     : ${result.ledger.length}`);
console.log(`reward grants      : ${result.grants.length}`);

const byKind = new Map<string, number>();
for (const a of result.anomalies) byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + 1);
console.log(`anomalies          : ${result.anomalies.length}`);
for (const [kind, n] of byKind) console.log(`  ${kind.padEnd(26)} ${n}`);

process.exit(0);

// Runs the scoring engine over what is actually in the database and prints the
// result. Read-only: it writes no ledger, and exists to sanity-check the engine
// against real data before the leaderboard is built on it.
import { db } from "@/lib/db";
import { creditedAssignments } from "@/lib/assignments/register";
import { toScoringConfig } from "@/lib/scoring/config";
import { score } from "@/lib/scoring/engine";

const [config, window, rewards, events, assignments] = await Promise.all([
  db.scoreConfig.findFirst({ where: { isActive: true } }),
  db.displayWindow.findFirst({ where: { isActive: true } }),
  db.reward.findMany({ where: { isActive: true } }),
  db.exchangeEvent.findMany(),
  creditedAssignments(),
]);

if (!config || !window) throw new Error("No active config or display window");

const result = score({
  events,
  assignments,
  config: toScoringConfig(config),
  window: { startsAt: window.startsAt, endsAt: window.endsAt },
  rewards: rewards.map((r) => ({
    id: r.id,
    thresholdType: r.thresholdType,
    threshold: Number(r.threshold),
  })),
});

console.log(`events in database : ${events.length}`);
console.log(`credits            : ${assignments.length}`);
console.log(`window             : ${window.startsAt.toISOString().slice(0, 10)} -> ${window.endsAt?.toISOString().slice(0, 10) ?? "open"}`);
console.log(`ledger entries     : ${result.ledger.length}`);
console.log(`reward grants      : ${result.grants.length}`);

const byKind = new Map<string, number>();
for (const a of result.anomalies) byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + 1);
console.log(`anomalies          : ${result.anomalies.length}`);
for (const [kind, n] of byKind) console.log(`  ${kind.padEnd(26)} ${n}`);

process.exit(0);

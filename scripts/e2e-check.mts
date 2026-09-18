// End-to-end proof of the chain: alias -> import -> replay -> leaderboard.
// Maps only labels with a single unambiguous candidate; ambiguous ones are left
// for an admin, which is the point of the queue.
import { db } from "@/lib/db";
import { importAssignments } from "@/lib/import/run-import";
import { normalise, suggestMembers } from "@/lib/import/name-matching";
import { individualStandings, officeStandings } from "@/lib/leaderboard";
import { replay } from "@/lib/scoring/replay";

const members = await db.member.findMany({
  where: { positions: { some: {} } },
  select: { id: true, fullName: true },
});

const preview = await importAssignments(0n, { dryRun: true });
let mapped = 0;
for (const entry of preview.unmappedLabels) {
  const s = suggestMembers(entry.label, members);
  if (s.length !== 1) {
    console.log(`  left for admin: ${entry.label} (${s.length} candidates)`);
    continue;
  }
  await db.managerAlias.upsert({
    where: { label: normalise(entry.label) },
    create: { label: normalise(entry.label), memberId: s[0].member.id },
    update: { memberId: s[0].member.id },
  });
  console.log(`  mapped: ${entry.label} -> ${s[0].member.fullName}`);
  mapped += 1;
}
console.log(`\naliases mapped: ${mapped}`);

const result = await importAssignments(0n, { dryRun: false });
console.log(`assignments written: ${result.assignmentsWritten}`);

const rebuilt = await replay(0n);
console.log(`ledger: ${rebuilt.ledgerEntries} entries, ${rebuilt.grants} grants, ${rebuilt.anomalies} anomalies`);

console.log("\nIndividual leaderboard (scorers):");
for (const s of (await individualStandings()).filter((x) => x.points !== 0)) {
  console.log(`  ${String(s.rank).padStart(2)}  ${s.fullName.padEnd(24)} ${s.officeName ?? "-"} APL=${s.aplCount} APD=${s.apdCount} RE=${s.reCount} pts=${s.points}`);
}

console.log("\nLC leaderboard:");
const { standings: officeRows, analyticsOk } = await officeStandings();
if (!analyticsOk) console.log("  (AIESEC analytics API unreachable -- totals below are zero placeholders)");
for (const o of officeRows) {
  console.log(`  ${o.rank}  ${o.officeName.padEnd(22)} members=${o.memberCount} pts=${o.points}`);
}
process.exit(0);

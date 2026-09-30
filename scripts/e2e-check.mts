// End-to-end proof of the chain: sheet import -> replay -> leaderboard. The
// import resolves EP managers through the MC sheet's directory tab and the
// console's matches (D-80).
import { importAssignments } from "@/lib/import/run-import";
import { activeWindowRange, individualStandings, officeStandings } from "@/lib/leaderboard";
import { replay } from "@/lib/scoring/replay";

const result = await importAssignments(0n, { dryRun: false });
console.log(`EPs credited from the sheet: ${result.assignmentsWritten}`);
for (const issue of result.issues) {
  console.log(`  ${issue.lineNumber ? `line ${issue.lineNumber}: ` : ""}${issue.detail}`);
}

const rebuilt = await replay(0n);
console.log(`ledger: ${rebuilt.ledgerEntries} entries, ${rebuilt.grants} grants, ${rebuilt.anomalies} anomalies`);

// The active window, so this proof and the replay above are measuring the same
// range; the boards themselves default to the whole term (D-58).
const range = await activeWindowRange();

console.log("\nIndividual leaderboard (scorers):");
for (const s of (await individualStandings(range)).filter((x) => x.points !== 0)) {
  console.log(`  ${String(s.rank).padStart(2)}  ${s.fullName.padEnd(24)} ${s.officeName ?? "-"} APL=${s.aplCount} APD=${s.apdCount} RE=${s.reCount} pts=${s.points}`);
}

console.log("\nLC leaderboard:");
const { standings: officeRows, analyticsOk } = await officeStandings(range);
if (!analyticsOk) console.log("  (AIESEC analytics API unreachable -- totals below are zero placeholders)");
for (const o of officeRows) {
  console.log(`  ${o.rank}  ${o.officeName.padEnd(22)} members=${o.memberCount} pts=${o.points}`);
}
process.exit(0);

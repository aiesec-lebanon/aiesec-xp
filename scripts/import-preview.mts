// Dry run of the sheet import. Writes nothing.
import { importAssignments } from "@/lib/import/run-import";

const result = await importAssignments(0n, { dryRun: true });

console.log(`sheet read         : ${result.sheetRead}`);
console.log(`EPs listed         : ${result.epsListed}`);
console.log(`EPs matched        : ${result.epsMatched}`);
console.log(`EPs with no manager: ${result.epsUnassigned}`);
for (const name of result.names) {
  if (name.status !== "matched") console.log(`  ${name.status.padEnd(10)} ${name.eps} EP(s), LC ${name.lc || "-"}, team ${name.team || "-"}`);
}

if (result.issues.length > 0) {
  console.log(`\nissues (${result.issues.length}):`);
  for (const issue of result.issues.slice(0, 20)) {
    const where = issue.lineNumber ? `line ${issue.lineNumber}` : "sheet";
    console.log(`  ${where}: ${issue.detail}`);
  }
}

process.exit(0);

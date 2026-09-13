// Dry run of the sheet import. Writes nothing.
import { importAssignments } from "@/lib/import/run-import";

const result = await importAssignments(0n, { dryRun: true });

console.log(`sheets read        : ${result.sheetsRead}`);
console.log(`rows read          : ${result.rowsRead}`);
console.log(`rows skipped       : ${result.rowsSkipped}`);
console.log(`would write        : ${result.assignmentsWritten} (dry run)`);

if (result.unmappedLabels.length > 0) {
  console.log(`\nunmapped manager labels (${result.unmappedLabels.length}):`);
  for (const entry of result.unmappedLabels) {
    const top = entry.suggestions
      .slice(0, 3)
      .map((s) => `${s.member.fullName} (${Math.round(s.confidence * 100)}%)`)
      .join(", ");
    console.log(`  ${entry.label.padEnd(12)} ${entry.rowCount} row(s)  ->  ${top || "no candidates"}`);
  }
}

if (result.issues.length > 0) {
  console.log(`\nissues (${result.issues.length}):`);
  for (const issue of result.issues.slice(0, 20)) {
    const where = issue.lineNumber ? `line ${issue.lineNumber}` : "sheet";
    console.log(`  [${issue.sheet}] ${where}: ${issue.detail}`);
  }
}

process.exit(0);

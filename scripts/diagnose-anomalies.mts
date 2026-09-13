import { db } from "@/lib/db";
const byKind = await db.scoringAnomaly.groupBy({ by: ["kind"], _count: true });
console.log("anomalies by kind:");
for (const a of byKind) console.log(`  ${a.kind.padEnd(26)} ${a._count}`);

const evs = await db.exchangeEvent.groupBy({ by: ["eventType"], _count: true });
console.log("\nevents in window by type:");
for (const e of evs) console.log(`  ${e.eventType.padEnd(11)} ${e._count}`);

const sheets = await db.assignmentSheet.findMany({ select: { label: true, lastImportAt: true } });
console.log("\nsheets:");
for (const s of sheets) console.log(`  ${s.label.padEnd(28)} lastImport=${s.lastImportAt?.toISOString().slice(0,16) ?? "never"}`);
process.exit(0);

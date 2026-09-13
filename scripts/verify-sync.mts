import { db } from "@/lib/db";

const byType = await db.exchangeEvent.groupBy({ by: ["eventType"], _count: true });
console.log("Events by type:");
for (const r of byType.sort((a, b) => a.eventType.localeCompare(b.eventType))) {
  console.log(`  ${r.eventType.padEnd(11)} ${r._count}`);
}

const byStatus = await db.exchangeEvent.groupBy({
  by: ["applicationStatus"], where: { eventType: "APL" }, _count: true,
});
console.log("\nAPL rows by application status:");
let withdrawnOrRejected = 0, total = 0;
for (const r of byStatus.sort((a, b) => b._count - a._count)) {
  console.log(`  ${(r.applicationStatus ?? "(null)").padEnd(11)} ${r._count}`);
  total += r._count;
  if (r.applicationStatus === "withdrawn" || r.applicationStatus === "rejected") withdrawnOrRejected += r._count;
}
console.log(`  net APL (D-41): ${total} - ${withdrawnOrRejected} = ${total - withdrawnOrRejected}`);

// The unique key must make duplicates impossible.
const dupes = await db.$queryRaw<Array<{ applicationId: bigint; eventType: string; n: bigint }>>`
  SELECT "applicationId", "eventType"::text AS "eventType", COUNT(*) AS n
  FROM "ExchangeEvent" GROUP BY 1, 2 HAVING COUNT(*) > 1`;
console.log(`\nduplicate (applicationId, eventType) rows: ${dupes.length}`);

const marks = await db.syncWatermark.findMany({ orderBy: { pass: "asc" } });
console.log("\nWatermarks:");
for (const m of marks) console.log(`  ${m.pass.padEnd(11)} ${m.watermark.toISOString()}`);

const runs = await db.syncRun.groupBy({ by: ["pass", "status"], _count: true });
console.log("\nSync runs:");
for (const r of runs.sort((a, b) => a.pass.localeCompare(b.pass))) {
  console.log(`  ${r.pass.padEnd(11)} ${r.status.padEnd(8)} ${r._count}`);
}
process.exit(0);

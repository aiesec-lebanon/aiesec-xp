import { db } from "@/lib/db";
const orphans = await db.member.findMany({
  where: { scoringOfficeId: null },
  select: { id: true, fullName: true, positions: { select: { officeId: true, roleName: true, title: true } } },
});
const offices = new Map((await db.office.findMany()).map((o) => [String(o.id), `${o.name} operating=${o.isOperating}`]));
console.log(`members with no scoring office: ${orphans.length}\n`);
for (const m of orphans) {
  console.log(`${m.fullName}`);
  for (const p of m.positions) {
    console.log(`   ${p.roleName ?? "-"} / ${p.title ?? "-"} @ ${offices.get(String(p.officeId)) ?? `office ${p.officeId} (NOT SYNCED)`}`);
  }
}
process.exit(0);

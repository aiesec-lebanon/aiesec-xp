import { db } from "@/lib/db";
import { normalise } from "@/lib/import/name-matching";

const labels = ["Najlaa", "Amar", "Mohamad", "Lea N", "Aleen"];
const members = await db.member.findMany({
  select: { id: true, fullName: true, scoringOfficeId: true },
  orderBy: { fullName: "asc" },
});
const offices = new Map((await db.office.findMany()).map((o) => [String(o.id), o.name]));

console.log(`roster holds ${members.length} members\n`);
for (const label of labels) {
  const first = normalise(label).split(" ")[0];
  // Loose contains-match purely to show near misses a strict matcher rejects.
  const near = members.filter((m) => {
    const n = normalise(m.fullName);
    return n.includes(first.slice(0, 3)) || first.includes(n.split(" ")[0].slice(0, 3));
  });
  console.log(`${label.padEnd(10)} -> ${near.length ? near.map((m) => m.fullName).join(", ") : "nothing close"}`);
}

console.log("\nfull roster:");
for (const m of members) {
  console.log(`  ${m.fullName.padEnd(28)} ${offices.get(String(m.scoringOfficeId)) ?? "-"}`);
}
process.exit(0);

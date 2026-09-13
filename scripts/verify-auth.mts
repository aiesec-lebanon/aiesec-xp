// End-to-end check of step 3 against live GIS: office scope, the login upsert,
// and the role the service token's own account resolves to.
import { db } from "@/lib/db";
import { gis } from "@/lib/gis/client";
import { recordLogin } from "@/lib/auth/login";
import { resolveAccess } from "@/lib/auth/roles";
import { operatingOfficeIds } from "@/lib/org/office-tree";

const offices = await db.office.findMany({ orderBy: { id: "asc" } });
console.log("Offices:");
for (const o of offices) {
  console.log(`  ${o.id} ${o.name}${o.isMc ? " [MC]" : ""} operating=${o.isOperating}`);
}

const { currentPerson } = await gis().CurrentPerson();
if (!currentPerson) throw new Error("no currentPerson");

const result = await recordLogin(currentPerson);
console.log(`\nrecordLogin -> member ${result.memberId}, role ${result.role}`);

const [member, matchers, operating] = await Promise.all([
  db.member.findUnique({ where: { id: result.memberId }, include: { positions: true } }),
  db.adminMatcher.findMany(),
  operatingOfficeIds(),
]);

const access = resolveAccess({
  positions: (member?.positions ?? []).map((p) => ({
    officeId: p.officeId, roleName: p.roleName, title: p.title, status: p.status,
  })),
  matchers,
  operatingOfficeIds: operating,
});

console.log(`stored positions: ${member?.positions.length}`);
for (const p of member?.positions ?? []) {
  console.log(`  ${p.roleName} / ${p.title} @ ${p.officeId} (${p.status})`);
}
console.log(`resolved role   : ${access.role}`);
console.log(`scoring office  : ${access.scoringOfficeId}`);
console.log(`lead offices    : ${access.leadOfficeIds.join(", ") || "(none)"}`);
console.log(`member.scoringOfficeId persisted: ${member?.scoringOfficeId}`);
process.exit(0);

import { db } from "@/lib/db";
const assigned = new Set((await db.epAssignment.findMany({ select: { epPersonId: true } })).map((a) => String(a.epPersonId)));
const eventEps = new Set((await db.exchangeEvent.findMany({ select: { epPersonId: true }, distinct: ["epPersonId"] })).map((e) => String(e.epPersonId)));
const overlap = [...assigned].filter((id) => eventEps.has(id));
console.log(`EPs assigned from sheets : ${assigned.size}`);
console.log(`EPs with events in window: ${eventEps.size}`);
console.log(`overlap                  : ${overlap.length}`);

const win = await db.displayWindow.findFirst({ where: { isActive: true } });
console.log(`window starts            : ${win?.startsAt.toISOString().slice(0,10)}`);

const assignments = await db.epAssignment.findMany({ select: { epPersonId: true, effectiveFrom: true } });
console.log("\nassigned EP ids:", [...assigned].sort().join(", "));
console.log("event EP ids   :", [...eventEps].sort().join(", "));
process.exit(0);

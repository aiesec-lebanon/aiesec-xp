import { db } from "@/lib/db";
const total = await db.exchangeEvent.count();
const distinct = await db.exchangeEvent.findMany({ select: { epPersonId: true }, distinct: ["epPersonId"] });
const win = await db.displayWindow.findFirst({ where: { isActive: true } });
const before = win ? await db.exchangeEvent.count({ where: { occurredAt: { lt: win.startsAt } } }) : 0;
const cols = await db.$queryRaw<Array<{ column_name: string }>>`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'ExchangeEvent' ORDER BY ordinal_position`;
console.log(`ExchangeEvent rows        : ${total}`);
console.log(`rows before window        : ${before}`);
console.log(`distinct EP ids retained  : ${distinct.length}`);
console.log(`columns: ${cols.map((c) => c.column_name).join(", ")}`);
const names = cols.filter((c) => /name|title|email|phone/i.test(c.column_name));
console.log(`identifying/descriptive columns remaining: ${names.length === 0 ? "none" : names.map(c=>c.column_name).join(", ")}`);
process.exit(0);

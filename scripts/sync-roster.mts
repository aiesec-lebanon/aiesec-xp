import { syncRoster } from "@/lib/sync/roster";
const r = await syncRoster();
console.log(`offices read      : ${r.officesRead}`);
console.log(`members upserted  : ${r.membersUpserted}`);
console.log(`positions upserted: ${r.positionsUpserted}`);
process.exit(0);

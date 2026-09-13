// Clears watermarks so the next run re-reads from the collection floor. Used to
// prove that a full re-sync stays inside the display window.
import { db } from "@/lib/db";
const { count } = await db.syncWatermark.deleteMany({});
console.log(`watermarks cleared: ${count}`);
process.exit(0);

// Populates the Office table, which route protection depends on. This becomes
// sync pass 8 in step 4; it exists now so auth has a scope to resolve against.
import { syncOfficeTree } from "@/lib/org/office-tree";

const result = await syncOfficeTree();
console.log(`offices synced: ${result.officesSeen}`);
console.log(`operating ids : ${result.operatingIds.join(", ") || "(none)"}`);
process.exit(0);

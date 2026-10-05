import { syncOfficeTree } from "@/lib/org/office-tree";

const result = await syncOfficeTree();
console.log(`offices synced: ${result.officesSeen}`);
console.log(`operating ids : ${result.operatingIds.join(", ") || "(none)"}`);
process.exit(0);

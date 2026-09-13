// Runs every sync pass. Becomes the cron target in step 7; for now it is how
// the passes are exercised against live GIS.
import { runAllPasses } from "@/lib/sync/run";

const results = await runAllPasses();
for (const r of results) {
  const detail = r.status === "FAILED" ? ` error=${r.error}` : "";
  console.log(
    `${r.pass.padEnd(11)} ${r.status.padEnd(7)} rows=${String(r.rowsSeen).padStart(4)} written=${String(r.eventsWritten).padStart(4)} skipped=${String(r.rowsSkipped).padStart(4)}${detail}`
  );
}
process.exit(results.some((r) => r.status === "FAILED") ? 1 : 0);

import type { NextRequest } from "next/server";

import { handleCron } from "@/lib/sync/cron";

// Long enough for every pass plus the ledger rebuild at Lebanon's volume; a
// partial run is safe, since a watermark only advances when its pass has read
// every page.
export const maxDuration = 300;

/**
 * EP data, called by .github/workflows/sync-ep-data.yml. `?cadence=hackathon`
 * is the five-minute tick, which only does work in hackathon mode (D-66);
 * anything else is the daily run.
 */
export async function POST(request: NextRequest) {
  const cadence = request.nextUrl.searchParams.get("cadence");
  return handleCron(request, "events", cadence === "hackathon" ? "HACKATHON" : "SCHEDULE");
}

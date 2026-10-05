import type { NextRequest } from "next/server";

import { handleCron } from "@/lib/sync/cron";

// A partial run is safe: a watermark only advances once its pass has read every page.
export const maxDuration = 300;

// `?cadence=hackathon` is the five-minute tick, a no-op outside hackathon mode.
export async function POST(request: NextRequest) {
  const cadence = request.nextUrl.searchParams.get("cadence");
  return handleCron(request, "events", cadence === "hackathon" ? "HACKATHON" : "SCHEDULE");
}

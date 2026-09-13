import { NextResponse } from "next/server";

import { isAuthorisedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { runAllPasses } from "@/lib/sync/run";

// Long enough for every pass at Lebanon's volume; a partial run is safe, since
// a watermark only advances when its pass has read every page.
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runAllPasses();
  const failed = results.filter((result) => result.status === "FAILED");

  if (failed.length > 0) {
    logger.error("Sync finished with failures", { failed: failed.map((r) => r.pass) });
  }

  // 500 on any failure, so the platform's cron monitoring notices rather than
  // relying on someone reading the body.
  return NextResponse.json({ results }, { status: failed.length > 0 ? 500 : 200 });
}

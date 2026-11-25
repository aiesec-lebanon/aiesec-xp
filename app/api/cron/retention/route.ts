import { NextResponse } from "next/server";

import { isAuthorisedCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { runRetention } from "@/lib/privacy/retention";

export const maxDuration = 300;

/** The daily retention sweep, called by .github/workflows/retention.yml. Counts only in the body. */
export async function POST(request: Request) {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  try {
    return NextResponse.json({ ok: true, dryRun, counts: await runRetention(dryRun) });
  } catch (error) {
    logger.error("Retention sweep failed", { error });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

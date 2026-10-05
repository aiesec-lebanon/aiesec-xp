import "server-only";

import { NextResponse } from "next/server";

import { isAuthorisedCron } from "@/lib/cron-auth";
import type { SyncJobName, SyncTrigger } from "@/lib/sync/cadence";
import { runSyncJob } from "@/lib/sync/jobs";

// Statuses and counts only, never error detail: the GitHub Actions logs printing this are public.
export async function handleCron(
  request: Request,
  job: SyncJobName,
  trigger: SyncTrigger
): Promise<NextResponse> {
  if (!isAuthorisedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await runSyncJob(job, trigger);
  if (run.outcome === "skipped") {
    return NextResponse.json({ job, outcome: "skipped", reason: run.reason });
  }

  const steps = run.steps.map(({ pass, status, rowsSeen, eventsWritten }) => ({
    pass,
    status,
    rowsSeen,
    eventsWritten,
  }));

  // 500 on any failure so the workflow run fails and GitHub notifies someone.
  return NextResponse.json(
    { job, outcome: "ran", ok: run.ok, durationMs: run.durationMs, steps },
    { status: run.ok ? 200 : 500 }
  );
}

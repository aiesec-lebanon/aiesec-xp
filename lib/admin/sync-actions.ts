"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatOfficeTime } from "@/lib/design/time-labels";
import { HACKATHON_HOURS, SYNC_JOBS, type SyncJobName } from "@/lib/sync/cadence";
import { hackathonUntil, runSyncJob, setHackathonUntil } from "@/lib/sync/jobs";

export type ActionState = { ok: boolean; message: string };

const hackathonSchema = z.discriminatedUnion("enabled", [
  z.object({
    enabled: z.literal("true"),
    hours: z.coerce
      .number()
      .refine((hours) => (HACKATHON_HOURS as readonly number[]).includes(hours), "Pick a duration"),
  }),
  z.object({ enabled: z.literal("false") }),
]);

/**
 * Switches hackathon mode on for a chosen number of hours, or off. It is stored
 * as an end time (D-66), so it lapses back to the daily cadence by itself.
 */
export async function setHackathonModeAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const parsed = hackathonSchema.safeParse({
    enabled: formData.get("enabled"),
    hours: formData.get("hours") ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: "Pick how long hackathon mode should stay on." };

  const before = await hackathonUntil();
  const after =
    parsed.data.enabled === "true" ? new Date(Date.now() + parsed.data.hours * 3_600_000) : null;
  await setHackathonUntil(after);

  await db.auditLog.create({
    data: {
      actorId: admin.id,
      action: "CONFIG_UPDATE",
      targetType: "SyncSettings",
      targetId: "singleton",
      beforeJson: { hackathonUntil: before?.toISOString() ?? null },
      afterJson: { hackathonUntil: after?.toISOString() ?? null },
    },
  });

  revalidatePath("/admin/sync");

  return after
    ? {
        ok: true,
        message: `Hackathon mode is on until ${formatOfficeTime(after)}. EP data now refreshes every 5 minutes.`,
      }
    : { ok: true, message: "Hackathon mode is off. EP data is back to refreshing once a day." };
}

const REFRESHED_PATHS: Record<SyncJobName, string[]> = {
  events: ["/admin/assignments", "/admin/sync", "/", "/me", "/leaderboard", "/leaderboard/lcs", "/tv"],
  roster: ["/admin/assignments", "/admin/sync", "/leaderboard", "/leaderboard/lcs", "/tv"],
};

/** Runs a sync job now, whatever the schedule says. */
export async function runSyncJobAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const parsed = z.enum(SYNC_JOBS).safeParse(formData.get("job"));
  if (!parsed.success) return { ok: false, message: "Unknown sync job." };

  const job = parsed.data;
  const run = await runSyncJob(job, "MANUAL", admin.id);

  if (run.outcome === "skipped") {
    return { ok: false, message: "A refresh is already running. Reload in a minute to see what it brought in." };
  }

  for (const path of REFRESHED_PATHS[job]) revalidatePath(path);

  const seconds = Math.max(1, Math.round(run.durationMs / 1000));
  if (!run.ok) {
    const failed = run.steps.filter((step) => step.status === "FAILED").map((step) => step.pass);
    return {
      ok: false,
      message: `Finished with errors${failed.length > 0 ? ` in ${failed.join(", ")}` : ""}. The Sync page has the detail.`,
    };
  }

  if (job === "roster") {
    const members = run.steps.find((step) => step.pass === "roster")?.rowsSeen ?? 0;
    return { ok: true, message: `Members synced in ${seconds}s: ${members} with an active position.` };
  }

  const applications = run.steps
    .filter((step) => step.pass !== "replay")
    .reduce((sum, step) => sum + step.rowsSeen, 0);
  return {
    ok: true,
    message: `EP data refreshed in ${seconds}s: ${applications} application rows read, scores rebuilt.`,
  };
}

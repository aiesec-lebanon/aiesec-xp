"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDisplay, toIso } from "@/lib/design/calendar";
import { replay } from "@/lib/scoring/replay";
import { setTermStart, termStart } from "@/lib/term";

export type ActionState = { ok: boolean; message: string };

async function audit(
  actorId: bigint,
  targetType: string,
  targetId: string,
  before: unknown,
  after: unknown
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId,
      action: "CONFIG_UPDATE",
      targetType,
      targetId,
      beforeJson: before === undefined ? undefined : JSON.parse(JSON.stringify(before)),
      afterJson: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
    },
  });
}

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");

const windowSchema = z
  .object({
    label: z.string().trim().min(1, "Give the period a name."),
    startsAt: dateOnly,
    endsAt: z.union([dateOnly, z.literal("")]),
  })
  .transform(({ label, startsAt, endsAt }) => ({
    label,
    startsAt: new Date(`${startsAt}T00:00:00.000Z`),
    endsAt: endsAt ? new Date(`${endsAt}T23:59:59.999Z`) : null,
  }))
  .refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
    message: "The end date needs to be after the start date.",
  });

// The previous window is deactivated, not deleted: it keeps its weights for dates it still covers.
export async function setDisplayWindowAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const parsed = windowSchema.safeParse({
    label: formData.get("label"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const [before, activeConfig] = await Promise.all([
    db.displayWindow.findFirst({ where: { isActive: true } }),
    db.scoreConfig.findFirst({ where: { isActive: true }, select: { version: true } }),
  ]);
  // A new period starts with the weights of the one it replaces.
  const configVersion = before?.configVersion ?? activeConfig?.version;
  if (configVersion === undefined) {
    return { ok: false, message: "Points aren't set up yet. Let whoever looks after the platform know." };
  }

  const after = await db.$transaction(async (tx) => {
    await tx.displayWindow.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.displayWindow.create({ data: { ...parsed.data, configVersion, isActive: true } });
  });

  await audit(admin.id, "DisplayWindow", after.id, before, after);
  await replay(admin.id);

  revalidatePath("/admin/window");
  revalidatePath("/leaderboard");
  revalidatePath("/leaderboard/lcs");
  revalidatePath("/tv");
  revalidatePath("/");

  const range = after.endsAt
    ? `${formatDisplay(toIso(parsed.data.startsAt))} to ${formatDisplay(toIso(after.endsAt))}`
    : `from ${formatDisplay(toIso(parsed.data.startsAt))}, with no end date`;
  return { ok: true, message: `Scoring period saved: ${range}. Points are up to date.` };
}

const termSchema = z.object({ startsAt: dateOnly }).transform(({ startsAt }) => ({
  startsAt: new Date(`${startsAt}T00:00:00.000Z`),
}));

// No replay: the ledger is derived from the window, not the term. Moving it later deletes nothing.
export async function setTermStartAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const parsed = termSchema.safeParse({ startsAt: formData.get("termStartsAt") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const before = await termStart();
  const after = await setTermStart(parsed.data.startsAt);

  await audit(admin.id, "TermSettings", "singleton", { startsAt: before }, { startsAt: after });

  revalidatePath("/admin/window");
  revalidatePath("/leaderboard");
  revalidatePath("/leaderboard/lcs");

  return { ok: true, message: `Term start saved: ${formatDisplay(toIso(after))}.` };
}

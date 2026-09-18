"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
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

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

const windowSchema = z
  .object({
    label: z.string().trim().min(1, "A label is required"),
    startsAt: dateOnly,
    endsAt: z.union([dateOnly, z.literal("")]),
  })
  .transform(({ label, startsAt, endsAt }) => ({
    label,
    startsAt: new Date(`${startsAt}T00:00:00.000Z`),
    endsAt: endsAt ? new Date(`${endsAt}T23:59:59.999Z`) : null,
  }))
  .refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
    message: "The end date must be after the start date",
  });

/**
 * Sets the one active display window (D-07). The previous window is
 * deactivated, not deleted, so past windows stay in the audit trail. Saving
 * replays the ledger (D-15): the window bounds which events count at all.
 */
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

  const before = await db.displayWindow.findFirst({ where: { isActive: true } });

  const after = await db.$transaction(async (tx) => {
    await tx.displayWindow.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.displayWindow.create({ data: { ...parsed.data, isActive: true } });
  });

  await audit(admin.id, "DisplayWindow", after.id, before, after);
  await replay(admin.id);

  revalidatePath("/admin/window");
  revalidatePath("/leaderboard");
  revalidatePath("/leaderboard/lcs");
  revalidatePath("/tv");
  revalidatePath("/");

  const range = after.endsAt
    ? `${parsed.data.startsAt.toDateString()} to ${after.endsAt.toDateString()}`
    : `${parsed.data.startsAt.toDateString()}, open-ended`;
  return { ok: true, message: `Display window set: ${range}.` };
}

const termSchema = z.object({ startsAt: dateOnly }).transform(({ startsAt }) => ({
  startsAt: new Date(`${startsAt}T00:00:00.000Z`),
}));

/**
 * Sets the term start (D-58): the collection floor, and where the leaderboards'
 * date range begins when nobody has picked one.
 *
 * No replay, unlike the display window above. The term bounds what is collected
 * and what a leaderboard may be read back to; the ledger is still derived
 * against the window, so nothing it holds changes here. Moving the term earlier
 * lets the next sync backfill; moving it later stops collecting further back but
 * deletes nothing, because the whole point of the term start is that history
 * behind the current window survives.
 */
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

  return { ok: true, message: `Term starts ${after.toDateString()}.` };
}

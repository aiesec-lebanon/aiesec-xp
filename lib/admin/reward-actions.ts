"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { replay } from "@/lib/scoring/replay";

export type ActionState = { ok: boolean; message: string };

async function audit(
  actorId: bigint,
  targetId: string,
  before: unknown,
  after: unknown
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId,
      action: "CONFIG_UPDATE",
      targetType: "Reward",
      targetId,
      beforeJson: before === undefined ? undefined : JSON.parse(JSON.stringify(before)),
      afterJson: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
    },
  });
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const rewardSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(1, "A label is required"),
  description: optionalText(500),
  thresholdType: z.enum(["POINTS", "APL_COUNT", "APD_COUNT", "RE_COUNT"]),
  threshold: z.coerce.number().positive("Threshold must be greater than zero"),
  valueAmount: z.union([z.coerce.number().nonnegative(), z.literal("")]).optional(),
  valueCurrency: optionalText(8),
  iconKey: optionalText(64),
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int(),
});

/** Creates or updates a reward, keyed by an optional hidden `id` field. Any
 * change replays the ledger (D-15): thresholds decide who has a grant. */
export async function saveRewardAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const parsed = rewardSchema.safeParse({
    id: formData.get("id") || undefined,
    label: formData.get("label"),
    description: formData.get("description") || undefined,
    thresholdType: formData.get("thresholdType"),
    threshold: formData.get("threshold"),
    valueAmount: formData.get("valueAmount") || "",
    valueCurrency: formData.get("valueCurrency") || undefined,
    iconKey: formData.get("iconKey") || undefined,
    isActive: formData.get("isActive") === "true",
    sortOrder: formData.get("sortOrder") || "0",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { id, valueAmount, ...rest } = parsed.data;
  const data = { ...rest, valueAmount: valueAmount === "" || valueAmount === undefined ? null : valueAmount };

  const before = id ? await db.reward.findUnique({ where: { id } }) : null;
  if (id && !before) return { ok: false, message: "That reward no longer exists." };

  const after = id
    ? await db.reward.update({ where: { id }, data })
    : await db.reward.create({ data });

  await audit(admin.id, after.id, before, after);
  await replay(admin.id);

  revalidatePath("/admin/rewards");
  revalidatePath("/");
  revalidatePath("/leaderboard");

  return { ok: true, message: `${after.label} saved.` };
}

export async function deleteRewardAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "A reward id is required." };

  const before = await db.reward.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "That reward no longer exists." };

  await db.reward.delete({ where: { id } });
  await audit(admin.id, id, before, null);
  await replay(admin.id);

  revalidatePath("/admin/rewards");
  revalidatePath("/");
  revalidatePath("/leaderboard");

  return { ok: true, message: `${before.label} removed.` };
}

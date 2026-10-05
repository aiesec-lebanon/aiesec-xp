"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { readRoleShares } from "@/lib/scoring/config";
import { replay } from "@/lib/scoring/replay";
import { readWeightsForm, sameWeights, validateWeights, type Weights } from "@/lib/scoring/weights";

export type ActionState = { ok: boolean; message: string };

// A new config version, never an edit: past periods keep pointing at the version that scored them.
export async function saveWeightsAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const [window, latest] = await Promise.all([
    db.displayWindow.findFirst({ where: { isActive: true }, include: { config: true } }),
    db.scoreConfig.aggregate({ _max: { version: true } }),
  ]);
  if (!window) return { ok: false, message: "There's no scoring period yet. Set one on the Period page first." };

  const active = window.config;
  const before: Weights = {
    aplPoints: Number(active.aplPoints),
    apdPoints: Number(active.apdPoints),
    rePoints: Number(active.rePoints),
    productWeights: active.productWeights as Record<string, number>,
    directionWeights: active.directionWeights as Record<string, number>,
    roleShares: readRoleShares(active.roleShares),
  };

  const after = readWeightsForm(formData, before);
  const problems = validateWeights(after);
  if (problems.length > 0) return { ok: false, message: problems[0]! };
  if (sameWeights(before, after)) return { ok: true, message: "No changes to save." };

  const version = (latest._max.version ?? active.version) + 1;

  try {
    await db.$transaction([
      db.scoreConfig.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      db.scoreConfig.create({
        data: {
          version,
          aplPoints: after.aplPoints,
          apdPoints: after.apdPoints,
          rePoints: after.rePoints,
          reverseApl: active.reverseApl,
          aplReversingStatuses: active.aplReversingStatuses as Prisma.InputJsonValue,
          productWeights: after.productWeights,
          directionWeights: after.directionWeights,
          scopeSides: active.scopeSides as Prisma.InputJsonValue,
          roleShares: { ...after.roleShares },
          isActive: true,
          createdBy: admin.id,
        },
      }),
      db.displayWindow.update({ where: { id: window.id }, data: { configVersion: version } }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: "CONFIG_UPDATE",
          targetType: "ScoreConfig",
          targetId: `v${version}`,
          beforeJson: { version: active.version, window: window.id, ...before },
          afterJson: { version, window: window.id, ...after },
        },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "Someone else saved points at the same time. Reload the page and try again." };
    }
    throw error;
  }

  // Leaderboards score on request, so if this fails the next sync's replay catches up.
  await replay(admin.id);

  for (const path of ["/admin/scoring", "/admin/assignments", "/", "/me", "/leaderboard", "/leaderboard/lcs", "/tv"]) {
    revalidatePath(path);
  }

  return { ok: true, message: `Points saved for ${window.label}. Everyone's points are up to date.` };
}

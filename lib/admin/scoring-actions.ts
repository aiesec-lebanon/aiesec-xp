"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { readRoleShares } from "@/lib/scoring/config";
import { replay } from "@/lib/scoring/replay";
import { normaliseRole, SHARE_FIELD_PREFIX, validateRoleShares } from "@/lib/scoring/shares";

export type ActionState = { ok: boolean; message: string };

function sameShares(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

/**
 * Saves each role's percentage of an event (D-83), as a new config
 * version rather than an edit: every ledger entry names the version that
 * produced it, and a replay recomputes history against the new one (D-15).
 */
export async function saveRoleSharesAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const shares: Record<string, number> = {};
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith(SHARE_FIELD_PREFIX) || typeof raw !== "string") continue;
    const role = normaliseRole(key.slice(SHARE_FIELD_PREFIX.length));
    shares[role] = raw.trim() === "" ? 0 : Number(raw);
  }

  const problems = validateRoleShares(shares);
  if (problems.length > 0) return { ok: false, message: problems[0]!.message };

  const [active, latest] = await Promise.all([
    db.scoreConfig.findFirst({ where: { isActive: true } }),
    db.scoreConfig.aggregate({ _max: { version: true } }),
  ]);
  if (!active) return { ok: false, message: "Points aren't set up yet, so there's nothing to change." };

  const before = readRoleShares(active.roleShares);
  if (sameShares({ ...before }, shares)) return { ok: true, message: "No changes to save." };

  const version = (latest._max.version ?? active.version) + 1;

  await db.$transaction([
    db.scoreConfig.update({ where: { id: active.id }, data: { isActive: false } }),
    db.scoreConfig.create({
      data: {
        version,
        aplPoints: active.aplPoints,
        apdPoints: active.apdPoints,
        rePoints: active.rePoints,
        reverseApl: active.reverseApl,
        aplReversingStatuses: active.aplReversingStatuses as Prisma.InputJsonValue,
        productWeights: active.productWeights as Prisma.InputJsonValue,
        directionWeights: active.directionWeights as Prisma.InputJsonValue,
        scopeSides: active.scopeSides as Prisma.InputJsonValue,
        roleShares: shares,
        isActive: true,
        createdBy: admin.id,
      },
    }),
    db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "CONFIG_UPDATE",
        targetType: "ScoreConfig",
        targetId: `v${version}`,
        beforeJson: { version: active.version, roleShares: { ...before } },
        afterJson: { version, roleShares: shares },
      },
    }),
  ]);

  await replay(admin.id);

  for (const path of ["/admin/scoring", "/admin/assignments", "/", "/me", "/leaderboard", "/tv"]) {
    revalidatePath(path);
  }

  return { ok: true, message: "Shares saved. Everyone's points are up to date." };
}

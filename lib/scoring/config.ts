import type { ScoreConfig } from "@prisma/client";

import type { ScoringConfig } from "@/lib/scoring/engine";
import { normaliseRole, type RoleShares } from "@/lib/scoring/shares";

// Shared by the replay and live leaderboards so the two can never score the same work differently.
export function toScoringConfig(config: ScoreConfig): ScoringConfig {
  return {
    version: config.version,
    aplPoints: Number(config.aplPoints),
    apdPoints: Number(config.apdPoints),
    rePoints: Number(config.rePoints),
    reverseApl: config.reverseApl,
    aplReversingStatuses: config.aplReversingStatuses as string[],
    productWeights: config.productWeights as Record<string, number>,
    directionWeights: config.directionWeights as Record<string, number>,
    roleShares: readRoleShares(config.roleShares),
  };
}

export function readRoleShares(value: unknown): RoleShares {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const shares: Record<string, number> = {};
  for (const [role, share] of Object.entries(value as Record<string, unknown>)) {
    const key = normaliseRole(role);
    if (key && typeof share === "number" && Number.isFinite(share)) shares[key] = share;
  }
  return shares;
}

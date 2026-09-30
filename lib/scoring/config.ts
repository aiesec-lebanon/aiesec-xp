import type { ScoreConfig } from "@prisma/client";

import type { ScoringConfig } from "@/lib/scoring/engine";
import { normaliseRole, type RoleShares } from "@/lib/scoring/shares";

/**
 * The stored config row as the pure engine wants it.
 *
 * Shared rather than inlined at each call site: the ledger replay and the
 * live-scored leaderboards (D-58) both read the same row, and a mapping that
 * drifted between them would show two different scores for the same work.
 */
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

/** Keys normalised, anything that is not a number dropped rather than trusted. */
export function readRoleShares(value: unknown): RoleShares {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const shares: Record<string, number> = {};
  for (const [role, share] of Object.entries(value as Record<string, unknown>)) {
    const key = normaliseRole(role);
    if (key && typeof share === "number" && Number.isFinite(share)) shares[key] = share;
  }
  return shares;
}

import type { ScoreConfig } from "@prisma/client";

import type { ScoringConfig } from "@/lib/scoring/engine";

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
  };
}

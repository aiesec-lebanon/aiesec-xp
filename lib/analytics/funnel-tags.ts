// Pure parsing of the AIESEC Analytics API's response shape, kept free of
// "server-only" and any fetch/env dependency so it can be unit tested directly
// (tests/aiesec-analytics.test.ts). lib/analytics/aiesec-analytics.ts is the
// server-only module that actually calls the endpoint and uses this to parse it.

// Products in scope (D-04): 7 = GV, 8 = GTa, 9 = GTe.
export const PROGRAMME_IDS = [7, 8, 9] as const;

// Stage name -> the funnel stage this product scores (D-05). "realized" is
// summed with "remote_realized" because remote realization scores identically
// to physical (D-29).
const STAGE_TAGS = {
  APL: ["applied"],
  APD: ["approved"],
  RE: ["realized", "remote_realized"],
} as const;

export type FunnelCounts = { APL: number; APD: number; RE: number };
export type ProductFunnelCounts = Record<number, FunnelCounts>;

function docCount(payload: Record<string, unknown>, tag: string): number {
  const entry = payload[tag];
  if (!entry || typeof entry !== "object") return 0;
  const count = (entry as { doc_count?: unknown }).doc_count;
  return typeof count === "number" ? count : 0;
}

/** Sums applications for one product across every tag a stage folds in, direction
 * fixed to outgoing (D-27: Lebanon runs outgoing exchange only, same as sync). */
export function countsFromPayload(
  payload: Record<string, unknown>,
  programmeIds: readonly number[]
): ProductFunnelCounts {
  const result: ProductFunnelCounts = {};
  for (const programmeId of programmeIds) {
    result[programmeId] = {
      APL: STAGE_TAGS.APL.reduce((sum, stage) => sum + docCount(payload, `o_${stage}_${programmeId}`), 0),
      APD: STAGE_TAGS.APD.reduce((sum, stage) => sum + docCount(payload, `o_${stage}_${programmeId}`), 0),
      RE: STAGE_TAGS.RE.reduce((sum, stage) => sum + docCount(payload, `o_${stage}_${programmeId}`), 0),
    };
  }
  return result;
}

/** Collapses per-product counts into one figure, for a screen that shows a
 * single APL/APD/RE per entity rather than a per-product breakdown. */
export function sumProducts(counts: ProductFunnelCounts): FunnelCounts {
  return Object.values(counts).reduce(
    (sum, entry) => ({ APL: sum.APL + entry.APL, APD: sum.APD + entry.APD, RE: sum.RE + entry.RE }),
    { APL: 0, APD: 0, RE: 0 }
  );
}

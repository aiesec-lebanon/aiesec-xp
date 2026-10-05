// 7 = GV, 8 = GTa, 9 = GTe.
export const PROGRAMME_IDS = [7, 8, 9] as const;

// Remote realization scores the same as physical.
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

// Outgoing (o_) tags only, matching what sync collects.
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

export function sumProducts(counts: ProductFunnelCounts): FunnelCounts {
  return Object.values(counts).reduce(
    (sum, entry) => ({ APL: sum.APL + entry.APL, APD: sum.APD + entry.APD, RE: sum.RE + entry.RE }),
    { APL: 0, APD: 0, RE: 0 }
  );
}

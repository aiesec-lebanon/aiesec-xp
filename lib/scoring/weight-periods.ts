import "server-only";

import { db } from "@/lib/db";
import { toScoringConfig } from "@/lib/scoring/config";
import type { ConfigAt, ScoringConfig } from "@/lib/scoring/engine";
import { weightsAt, type WeightPeriod } from "@/lib/scoring/periods";

/** Every scoring period, past and current, with the weights it keeps (D-85). */
export async function loadWeightPeriods(): Promise<WeightPeriod[]> {
  const windows = await db.displayWindow.findMany({ include: { config: true } });
  return windows.map((window) => ({
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    savedAt: window.createdAt,
    config: toScoringConfig(window.config),
  }));
}

/** Null when no period exists yet, which every caller already treats as "nothing to score". */
export async function loadConfigAt(): Promise<ConfigAt | null> {
  const periods = await loadWeightPeriods();
  return periods.length === 0 ? null : weightsAt(periods);
}

/** The active period's weights, which any score shown today is earning under. */
export async function loadCurrentWeights(): Promise<{ label: string; config: ScoringConfig } | null> {
  const window = await db.displayWindow.findFirst({ where: { isActive: true }, include: { config: true } });
  return window ? { label: window.label, config: toScoringConfig(window.config) } : null;
}

import "server-only";

import { db } from "@/lib/db";

// The watermark is how a 15-minute sync avoids re-reading the whole corpus. It
// advances only when a pass completes in full, so a failure halfway through
// costs a repeat rather than a gap.

/**
 * Back-dated records are the reason for the overlap: GIS timestamps reflect when
 * something happened, not when it was entered, so a record can appear behind a
 * watermark that has already moved past it.
 */
export const OVERLAP_MS = 48 * 60 * 60 * 1000;

/** Where a pass starts when it has never run. */
const DEFAULT_LOOKBACK_MS = 365 * 24 * 60 * 60 * 1000;

export type Window = { from: Date; to: Date };

export async function readWatermark(pass: string): Promise<Date | null> {
  const row = await db.syncWatermark.findUnique({ where: { pass } });
  return row?.watermark ?? null;
}

export async function windowFor(pass: string, now = new Date()): Promise<Window> {
  const watermark = await readWatermark(pass);
  const from = watermark
    ? new Date(watermark.getTime() - OVERLAP_MS)
    : new Date(now.getTime() - DEFAULT_LOOKBACK_MS);

  return { from, to: now };
}

/** Called only after a pass has read every page without error. */
export async function advanceWatermark(pass: string, to: Date): Promise<void> {
  await db.syncWatermark.upsert({
    where: { pass },
    create: { pass, watermark: to },
    update: { watermark: to },
  });
}

export function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

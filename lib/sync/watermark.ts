import "server-only";

import { db } from "@/lib/db";
import { termStart } from "@/lib/term";

// The watermark is how a frequent sync avoids re-reading the whole corpus. It
// advances only when a pass completes in full, so a failure halfway through
// costs a repeat rather than a gap.

/**
 * Back-dated records are the reason for the overlap: GIS timestamps reflect when
 * something happened, not when it was entered, so a record can appear behind a
 * watermark that has already moved past it.
 */
export const OVERLAP_MS = 48 * 60 * 60 * 1000;

export type Window = { from: Date; to: Date };

/**
 * The earliest moment this system may collect anything (D-43, amended by D-58).
 *
 * Still bounded by purpose -- this holds what it scores, not a copy of EXPA --
 * but the bound is the term start rather than the active display window's. Under
 * D-43 they were the same date, which meant moving the window forward stopped
 * collecting everything behind it, and a leaderboard read over a historic range
 * would have found nothing there.
 */
export async function collectionFloor(): Promise<Date> {
  return termStart();
}

export async function readWatermark(pass: string): Promise<Date | null> {
  const row = await db.syncWatermark.findUnique({ where: { pass } });
  return row?.watermark ?? null;
}

export async function windowFor(pass: string, now = new Date()): Promise<Window> {
  const floor = await collectionFloor();
  const watermark = await readWatermark(pass);

  const candidate = watermark ? new Date(watermark.getTime() - OVERLAP_MS) : floor;
  // The floor wins even against a watermark, so moving the display window later
  // narrows collection immediately rather than at the next full rebuild.
  return { from: candidate < floor ? floor : candidate, to: now };
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

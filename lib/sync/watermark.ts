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

export type Window = { from: Date; to: Date };

/**
 * The earliest moment this system may collect anything (D-43).
 *
 * Nothing before the active display window is scored, so nothing before it is
 * fetched or stored either. This is the difference between holding data with a
 * purpose and holding a copy of EXPA: at the point it was introduced, 206 of
 * 269 stored events fell outside the window and existed for no reason.
 */
export async function collectionFloor(): Promise<Date> {
  const window = await db.displayWindow.findFirst({ where: { isActive: true } });
  if (!window) {
    throw new Error("No active DisplayWindow; sync has no bound and must not run");
  }
  return window.startsAt;
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

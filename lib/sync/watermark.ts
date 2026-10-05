import "server-only";

import { db } from "@/lib/db";
import { termStart } from "@/lib/term";

// GIS timestamps are when something happened, not when it was entered, so
// back-dated records can land behind an already-advanced watermark.
const OVERLAP_MS = 48 * 60 * 60 * 1000;

export type Window = { from: Date; to: Date };

async function collectionFloor(): Promise<Date> {
  return termStart();
}

async function readWatermark(pass: string): Promise<Date | null> {
  const row = await db.syncWatermark.findUnique({ where: { pass } });
  return row?.watermark ?? null;
}

export async function windowFor(pass: string, now = new Date()): Promise<Window> {
  const floor = await collectionFloor();
  const watermark = await readWatermark(pass);

  const candidate = watermark ? new Date(watermark.getTime() - OVERLAP_MS) : floor;
  // The floor wins even against a watermark, so moving the term start narrows
  // collection immediately rather than at the next full rebuild.
  return { from: candidate < floor ? floor : candidate, to: now };
}

// Call only after a pass has read every page without error, so a failure costs a repeat, not a gap.
export async function advanceWatermark(pass: string, to: Date): Promise<void> {
  await db.syncWatermark.upsert({
    where: { pass },
    create: { pass, watermark: to },
    update: { watermark: to },
  });
}

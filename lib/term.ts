import "server-only";

import { db } from "@/lib/db";

// Throws instead of defaulting: a missing row means migrations haven't run, and a
// silent default would turn a broken deployment into a wrong leaderboard.
export async function termStart(): Promise<Date> {
  const settings = await db.termSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    throw new Error("No TermSettings row; run migrations before serving requests");
  }
  return settings.startsAt;
}

export type CurrentWindow = { startsAt: Date; endsAt: Date | null };

export async function currentWindow(): Promise<CurrentWindow> {
  const window = await db.displayWindow.findFirst({ where: { isActive: true } });
  if (window) return { startsAt: window.startsAt, endsAt: window.endsAt };
  return { startsAt: await termStart(), endsAt: null };
}

export async function setTermStart(startsAt: Date): Promise<Date> {
  const settings = await db.termSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", startsAt },
    update: { startsAt },
  });
  return settings.startsAt;
}

import "server-only";

import { db } from "@/lib/db";

// The term start (D-58): the earliest date this system collects, scores or
// shows anything for.
//
// It is deliberately not the active DisplayWindow's start. The window is the
// range the reward race is measured in and the MC moves it; the term is the
// floor under all of it, and moving the window must never decide how much
// history survives.

/**
 * Throws when the row is missing rather than falling back to a constant. The
 * migration creates it, so absent means migrations have not been run -- in
 * which case there is no ScoreConfig either and a silent default would only
 * turn a broken deployment into a wrong leaderboard.
 */
export async function termStart(): Promise<Date> {
  const settings = await db.termSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    throw new Error("No TermSettings row; run migrations before serving requests");
  }
  return settings.startsAt;
}

export async function setTermStart(startsAt: Date): Promise<Date> {
  const settings = await db.termSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", startsAt },
    update: { startsAt },
  });
  return settings.startsAt;
}

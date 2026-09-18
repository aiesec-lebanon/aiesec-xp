"use client";

import { Character } from "./character";
import { useMoodFlourish } from "./mood-flourish";

/**
 * The one live body per side on the sign-in screen (D-60).
 *
 * Only a mood flourish, not the conversational "group" behaviour the LC
 * leaderboard has: that needs at least two live bodies trading glances, and
 * this screen deliberately keeps one canvas per side -- see the comment on
 * `CharacterGroup` in `app/login/page.tsx`. Ask if that trade-off should be
 * revisited before building a real group scene here.
 */
export function LoginBody({ name, height }: { name: string; height: number }) {
  const mood = useMoodFlourish("idle", {
    active: true,
    moods: ["calm"],
    hold: [8, 14],
    gap: [10, 22],
  });

  return <Character name={name} height={height} stage mood={mood} />;
}

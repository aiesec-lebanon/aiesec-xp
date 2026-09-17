// Game Icons (game-icons.net), CC BY 3.0, delivered through react-icons as
// tree-shaken SVG components -- no sprite sheet, no CDN, no emoji. Credit lives
// in ATTRIBUTIONS.md and not in the UI; see D-49.
//
// Only the icons the product actually names live here. Reaching into
// react-icons/gi directly is fine for one-offs, but anything that stands for a
// domain concept belongs in the maps below, so the concept has one picture
// everywhere it appears.

import {
  GiAirplaneDeparture,
  GiBrokenRibbon,
  GiLaurels,
  GiPaperPlane,
  GiPodium,
  GiPodiumSecond,
  GiPodiumThird,
  GiPodiumWinner,
  GiSpeedometer,
  GiStopwatch,
  GiTargetPrize,
  GiTrophy,
  GiWaxSeal,
} from "react-icons/gi";

import type { GameIconComponent } from "./game-icon";

export { GameIcon } from "./game-icon";
export type { GameIconComponent, GameIconProps } from "./game-icon";

/** Keyed by FunnelEvent, so a ledger row can render its own stage. */
export const STAGE_ICON: Record<string, GameIconComponent> = {
  APL: GiPaperPlane,
  APD: GiWaxSeal,
  RE: GiAirplaneDeparture,
  APD_BROKEN: GiBrokenRibbon,
  RE_BROKEN: GiBrokenRibbon,
};

export const RANK_ICON: Record<1 | 2 | 3, GameIconComponent> = {
  1: GiPodiumWinner,
  2: GiPodiumSecond,
  3: GiPodiumThird,
};

export const ICON = {
  reward: GiTrophy,
  threshold: GiTargetPrize,
  pace: GiSpeedometer,
  windowClosing: GiStopwatch,
  lcLeaderboard: GiPodium,
  personalBest: GiLaurels,
} as const;

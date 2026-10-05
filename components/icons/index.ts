// Game Icons (game-icons.net), CC BY 3.0; credit lives in ATTRIBUTIONS.md.

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

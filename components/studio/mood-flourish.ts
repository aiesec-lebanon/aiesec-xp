"use client";

import { useEffect, useRef, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import type { CharacterMood } from "@/lib/design/character";

type Range = readonly [number, number];

export type MoodFlourishOptions = {
  active: boolean;
  moods: readonly CharacterMood[];
  /** Seconds. */
  hold?: Range;
  /** Seconds. */
  gap?: Range;
};

const DEFAULT_HOLD: Range = [6, 11];
const DEFAULT_GAP: Range = [14, 30];

function pick<T>(from: readonly T[]): T {
  return from[Math.floor(Math.random() * from.length)]!;
}

function seconds([min, max]: Range): number {
  return (min + Math.random() * (max - min)) * 1000;
}

export function useMoodFlourish(base: CharacterMood, options: MoodFlourishOptions): CharacterMood {
  const reduceMotion = useReduceMotion();
  const [flourish, setFlourish] = useState<CharacterMood | null>(null);
  // Callers pass fresh array literals; depending on them would restart the timer every render.
  const live = useRef(options);
  useEffect(() => {
    live.current = options;
  });

  const running = options.active && !reduceMotion && options.moods.length > 0;

  useEffect(() => {
    if (!running) return;

    let timer: ReturnType<typeof setTimeout>;
    const toFlourish = () => {
      setFlourish(pick(live.current.moods));
      timer = setTimeout(() => {
        setFlourish(null);
        timer = setTimeout(toFlourish, seconds(live.current.gap ?? DEFAULT_GAP));
      }, seconds(live.current.hold ?? DEFAULT_HOLD));
    };

    timer = setTimeout(toFlourish, seconds(live.current.gap ?? DEFAULT_GAP));
    return () => clearTimeout(timer);
  }, [running]);

  return running ? (flourish ?? base) : base;
}

"use client";

import { useEffect, useRef, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import type { CharacterMood } from "@/lib/design/character";

type Range = readonly [number, number];

export type MoodFlourishOptions = {
  /** Off entirely: the base mood plays and nothing more (D-60). */
  active: boolean;
  /** Moods drawn from at random between spells of the base mood. */
  moods: readonly CharacterMood[];
  /** How long a flourish holds before reverting to the base, in seconds. */
  hold?: Range;
  /** How long the base mood holds before the next flourish, in seconds. */
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

/**
 * A mood that mostly holds steady and, every so often, breaks into something
 * else for a while -- a leader dancing between cheers, a group where every
 * body has its own reason (D-60). Each call keeps its own timer, so several
 * bodies using this in the same group land on different moments by
 * construction rather than by chance.
 */
export function useMoodFlourish(base: CharacterMood, options: MoodFlourishOptions): CharacterMood {
  const reduceMotion = useReduceMotion();
  const [flourish, setFlourish] = useState<CharacterMood | null>(null);
  // Read inside the timer without retriggering it on every render: the hold
  // and gap ranges are usually written as fresh array literals at the call
  // site, and depending on them would restart the timer every render.
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

  // Derived rather than cleared on the way out, so stopping does not cost a
  // render pass of its own (mirrors useGroupExchange in group-exchange.ts).
  return running ? (flourish ?? base) : base;
}

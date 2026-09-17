import { useEffect, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import type { CharacterBeat } from "@/lib/design/character";

/** Yaw towards a neighbour being spoken to, against 0.42 for standing inwards. */
export const TOWARDS = 0.62;
/** Standing angled into the group rather than square to camera. */
export const INWARDS = 0.42;

const EXCHANGE = { gapMin: 5, gapMax: 13, hold: 3.4, reply: 0.9 };
const ONLOOKER_CHANCE = 0.4;

export type Exchange = {
  speaker: number;
  listener: number;
  onlooker: number | null;
  /** The listener only answers once the speaker has started. */
  replying: boolean;
  /** Alternates the talk clip so a pair does not repeat itself. */
  tick: number;
};

/**
 * Picks a pair, now and then, and lets the rest of the group ignore them.
 *
 * A group where everybody reacts at once is as artificial as a group where
 * nobody does, so the third body only looks over some of the time, and the gap
 * between exchanges is never the same twice.
 */
export function useGroupExchange(count: number): Exchange | null {
  const reduceMotion = useReduceMotion();
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const running = count >= 2 && !reduceMotion;

  useEffect(() => {
    if (!running) return;

    let timer: ReturnType<typeof setTimeout>;
    let tick = 0;

    const start = () => {
      tick += 1;
      const speaker = Math.floor(Math.random() * count);
      let listener = Math.floor(Math.random() * (count - 1));
      if (listener >= speaker) listener += 1;

      const others = Array.from({ length: count }, (_, i) => i).filter(
        (i) => i !== speaker && i !== listener,
      );
      const onlooker =
        others.length > 0 && Math.random() < ONLOOKER_CHANCE
          ? others[Math.floor(Math.random() * others.length)]!
          : null;

      const next: Exchange = { speaker, listener, onlooker, replying: false, tick };
      setExchange(next);

      timer = setTimeout(() => {
        setExchange({ ...next, replying: true });
        timer = setTimeout(() => {
          setExchange(null);
          timer = setTimeout(start, gap());
        }, (EXCHANGE.hold - EXCHANGE.reply) * 1000);
      }, EXCHANGE.reply * 1000);
    };

    timer = setTimeout(start, gap());
    return () => clearTimeout(timer);
  }, [running, count]);

  // Derived rather than cleared, so stopping does not cost a render pass.
  return running ? exchange : null;
}

/** Who this body is attending to, if anyone. */
export function partnerOf(exchange: Exchange | null, index: number): number | null {
  if (!exchange) return null;
  if (exchange.speaker === index) return exchange.listener;
  if (exchange.listener === index || exchange.onlooker === index) return exchange.speaker;
  return null;
}

export function beatFor(exchange: Exchange | null, index: number): CharacterBeat | null {
  if (!exchange) return null;
  if (exchange.speaker === index) return exchange.tick % 2 === 0 ? "talk" : "talkAgain";
  if (exchange.listener === index) return exchange.replying ? "agree" : null;
  if (exchange.onlooker === index) return "glance";
  return null;
}

/**
 * Which way to look, in radians of yaw.
 *
 * The bodies are exported facing +Z, so a positive yaw turns towards +x. A body
 * left of the group therefore needs a *positive* angle to look into it.
 */
export function facingFor(
  exchange: Exchange | null,
  index: number,
  positionOf: (index: number) => number,
): number {
  const partner = partnerOf(exchange, index);
  const self = positionOf(index);
  if (partner === null) return self === 0 ? 0 : -Math.sign(self) * INWARDS;
  return Math.sign(positionOf(partner) - self) * TOWARDS;
}

function gap(): number {
  return (EXCHANGE.gapMin + Math.random() * (EXCHANGE.gapMax - EXCHANGE.gapMin)) * 1000;
}

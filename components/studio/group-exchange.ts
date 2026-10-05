import { useEffect, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import type { CharacterBeat } from "@/lib/design/character";

const TOWARDS = 0.62;
const INWARDS = 0.42;

const EXCHANGE = { gapMin: 5, gapMax: 13, hold: 3.4, reply: 0.9 };
const ONLOOKER_CHANCE = 0.4;

export type Exchange = {
  speaker: number;
  listener: number;
  onlooker: number | null;
  replying: boolean;
  tick: number;
};

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

  return running ? exchange : null;
}

function partnerOf(exchange: Exchange | null, index: number): number | null {
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

// Bodies are exported facing +Z, so positive yaw turns towards +x.
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

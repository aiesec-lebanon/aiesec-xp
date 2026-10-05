"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import type { CharacterBeat } from "@/lib/design/character";

import { Character } from "./character";
import { useMoodFlourish } from "./mood-flourish";

type HeroBeatContext = {
  hovered: CharacterBeat | null;
  setHovered: (beat: CharacterBeat | null) => void;
};

const Context = createContext<HeroBeatContext | null>(null);

export function HeroBeatScope({ children }: { children: ReactNode }) {
  const [hovered, setHovered] = useState<CharacterBeat | null>(null);
  const value = useMemo(() => ({ hovered, setHovered }), [hovered]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function HeroCharacter({
  beat,
  mood,
  leading = false,
  points,
  ...props
}: Omit<Parameters<typeof Character>[0], "beat"> & {
  beat?: CharacterBeat | null;
  leading?: boolean;
  points?: number;
}) {
  const context = useContext(Context);
  const dropped = usePointsDrop(points);

  const flourishMood = useMoodFlourish(mood ?? "idle", {
    active: leading,
    moods: ["dancing"],
    hold: [7, 13],
    gap: [16, 32],
  });
  const dancing = flourishMood === "dancing";

  const replay = useLeaderReplay(leading && !dancing);

  const effectiveBeat = context?.hovered ?? (dropped ? "losePoints" : null) ?? replay ?? beat ?? null;

  return (
    <Character {...props} mood={dancing ? "dancing" : mood} beat={effectiveBeat} />
  );
}

const REPLAY = { min: 20, max: 42 };

function useLeaderReplay(active: boolean): CharacterBeat | null {
  const reduceMotion = useReduceMotion();
  const [beat, setBeat] = useState<CharacterBeat | null>(null);
  const running = active && !reduceMotion;

  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const gap = () => (REPLAY.min + Math.random() * (REPLAY.max - REPLAY.min)) * 1000;
    const tick = () => {
      setBeat("celebrate");
      timer = setTimeout(() => {
        setBeat(null);
        timer = setTimeout(tick, gap());
      }, 3000);
    };
    timer = setTimeout(tick, gap());
    return () => clearTimeout(timer);
  }, [running]);

  return running ? beat : null;
}

const POINTS_KEY = "xp:points:dashboard";

// sessionStorage, not a ref: the drop can happen between two page loads.
function usePointsDrop(points: number | undefined): boolean {
  const [dropped, setDropped] = useState(false);

  useEffect(() => {
    if (points === undefined) return;
    let previous: number | null = null;
    try {
      const stored = sessionStorage.getItem(POINTS_KEY);
      previous = stored === null ? null : Number(stored);
      sessionStorage.setItem(POINTS_KEY, String(points));
    } catch {
      return;
    }
    if (previous === null || Number.isNaN(previous) || points >= previous) return;

    // Deferred: a synchronous setState in an effect body trips React's cascading-render lint.
    const start = setTimeout(() => setDropped(true), 0);
    const clear = setTimeout(() => setDropped(false), 1600);
    return () => {
      clearTimeout(start);
      clearTimeout(clear);
    };
  }, [points]);

  return dropped;
}

export function BeatOnHover({
  beat,
  children,
  className,
}: {
  beat: CharacterBeat;
  children: ReactNode;
  className?: string;
}) {
  const context = useContext(Context);
  if (!context) return <div className={className}>{children}</div>;

  const on = () => context.setHovered(beat);
  const off = () => context.setHovered(null);

  return (
    <div
      className={className}
      onPointerEnter={on}
      onPointerLeave={off}
      onFocusCapture={on}
      onBlurCapture={off}
    >
      {children}
    </div>
  );
}

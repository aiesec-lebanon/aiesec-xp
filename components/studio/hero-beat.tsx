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

/**
 * Lets something elsewhere on the page make the hero react.
 *
 * The body and the card that talks about a rival are in different columns of a
 * server-rendered grid, so the two cannot simply share state. This is the
 * smallest thing that connects them.
 */
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
  /** Properly in first place, not merely doing well (D-60). */
  leading?: boolean;
  /** Fires a brief `disappointed` beat when this drops between renders. */
  points?: number;
}) {
  const context = useContext(Context);
  const dropped = usePointsDrop(points);

  // A leader's loop mostly holds the passed-in mood and, now and then, breaks
  // into dancing for a while instead -- never both at once, and never for
  // anyone who has not actually won (D-60).
  const flourishMood = useMoodFlourish(mood ?? "idle", {
    active: leading,
    moods: ["dancing"],
    hold: [7, 13],
    gap: [16, 32],
  });
  const dancing = flourishMood === "dancing";

  // The victory beat gets the same treatment: replayed occasionally rather
  // than once on mount, and never while the body is already off dancing.
  const replay = useLeaderReplay(leading && !dancing);

  // What the member is doing right now outranks what the numbers say; a fresh
  // drop in points outranks a beat that was already true before it happened.
  const effectiveBeat = context?.hovered ?? (dropped ? "losePoints" : null) ?? replay ?? beat ?? null;

  return (
    <Character {...props} mood={dancing ? "dancing" : mood} beat={effectiveBeat} />
  );
}

const REPLAY = { min: 20, max: 42 };

/** Replays the `celebrate` beat every so often, rather than once on mount. */
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

/**
 * True for a moment when `points` is lower than the value last seen in this
 * browser session -- an APL reversal or a break landing between one visit to
 * the dashboard and the next, not a first render with nothing to compare
 * against. Sessionstorage, not a ref, because the drop can just as well have
 * happened between two page loads as while one is mounted.
 */
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
      // Private mode, or storage refused. A missed reaction is not worth a throw.
      return;
    }
    if (previous === null || Number.isNaN(previous) || points >= previous) return;

    // Deferred rather than set synchronously here: React flags a setState
    // called directly in an effect body as a likely cascading render, and the
    // fix it asks for -- setting state from a callback, not the effect's own
    // top-level flow -- is exactly what a zero-delay timer gives it.
    const start = setTimeout(() => setDropped(true), 0);
    const clear = setTimeout(() => setDropped(false), 1600);
    return () => {
      clearTimeout(start);
      clearTimeout(clear);
    };
  }, [points]);

  return dropped;
}

/** Wraps something that should make the hero react while it is pointed at. */
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

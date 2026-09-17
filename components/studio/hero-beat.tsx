"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { CharacterBeat } from "@/lib/design/character";

import { Character } from "./character";

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
  ...props
}: Omit<Parameters<typeof Character>[0], "beat"> & { beat?: CharacterBeat | null }) {
  const context = useContext(Context);
  // What the member is doing right now outranks what the numbers say.
  return <Character {...props} beat={context?.hovered ?? beat ?? null} />;
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

"use client";

import { m } from "motion/react";
import { useEffect, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { CHARACTERS } from "@/lib/design/character";

import { CharacterStage } from "./character-stage";
import { preloadCharacter } from "./character-model";

export function useCharacterChoice(initialCharacter: string) {
  const [index, setIndex] = useState(() =>
    Math.max(
      CHARACTERS.findIndex((character) => character.id === initialCharacter),
      0,
    ),
  );
  // Which way the last step went, so the new body arrives from the side the
  // member reached towards and the old one leaves the other way.
  const [enterFrom, setEnterFrom] = useState<1 | -1>(1);

  const step = (by: number) => {
    setIndex((current) => (current + by + CHARACTERS.length) % CHARACTERS.length);
    setEnterFrom(by > 0 ? 1 : -1);
  };

  return { character: CHARACTERS[index]!, index, step, enterFrom };
}

/** The set: a body on the cyclorama, an arrow either side, and its name. */
export function CharacterCarousel({
  memberName,
  index,
  step,
  enterFrom,
  height = 430,
}: {
  memberName: string;
  index: number;
  step: (by: number) => void;
  enterFrom: 1 | -1;
  height?: number;
}) {
  const reduceMotion = useReduceMotion();
  const character = CHARACTERS[index]!;

  // Every body is one arrow press away, and a swap that has to fetch a .glb
  // first would drop the outgoing walk on the floor.
  useEffect(() => {
    for (const option of CHARACTERS) preloadCharacter(option.id);
  }, []);

  return (
    <div className="relative flex flex-1 items-end justify-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 bottom-24"
        style={{ background: "radial-gradient(ellipse at 50% 26%, #ffffff 0%, var(--set-wall) 64%)" }}
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-floor" />
      <div aria-hidden className="absolute inset-x-0 bottom-24 h-0.5 bg-horizon" />

      {/* The switcher lives on the set rather than in a side panel: four
          thumbnails in a 280px column overflowed it. */}
      <StepButton side="left" onClick={() => step(-1)} reduceMotion={reduceMotion} />
      <StepButton side="right" onClick={() => step(1)} reduceMotion={reduceMotion} />

      {/* The canvas spans the whole set, so a body that walks off leaves the
          frame the member can see rather than the edge of a narrow box sitting
          in the middle of it. floorFraction lands its feet on the horizon. */}
      <CharacterStage
        id={character.id}
        name={memberName}
        height={height}
        interactive
        enterFrom={enterFrom}
        fill
        heightFraction={0.62}
        floorFraction={0.2}
        eager
      />

      <div className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1.5">
        <p className="font-display text-lg font-semibold text-ink">{character.name}</p>
        <p className="text-[11px] text-ink-muted">{character.label}</p>
        <div className="mt-1 flex gap-1.5">
          {CHARACTERS.map((option, dot) => (
            <span
              key={option.id}
              aria-hidden
              className={`size-1.5 rounded-full transition-colors ${
                dot === index ? "bg-ink" : "bg-ink-faint/40"
              }`}
            />
          ))}
        </div>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-1 z-10 text-center text-[10px] text-ink-faint">
        Drag to turn
      </p>
    </div>
  );
}

function StepButton({
  side,
  onClick,
  reduceMotion,
}: {
  side: "left" | "right";
  onClick: () => void;
  reduceMotion: boolean;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous character" : "Next character"}
      whileHover={reduceMotion ? undefined : { scale: 1.08 }}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 520, damping: 18 }}
      className={`absolute top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-surface-sunken bg-surface/90 text-ink shadow-e1 backdrop-blur ${
        side === "left" ? "left-5" : "right-5"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4.5" fill="none" aria-hidden>
        <path
          d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </m.button>
  );
}

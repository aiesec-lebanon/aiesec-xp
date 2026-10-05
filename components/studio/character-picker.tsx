"use client";

import { m } from "motion/react";
import { useEffect, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import {
  CHARACTERS,
  CHARACTER_FORMS,
  palettesFor,
  variantId,
  type CharacterBeat,
} from "@/lib/design/character";

import { CharacterStage } from "./character-stage";
import { preloadCharacter } from "./character-model";

export function useCharacterChoice(initialCharacter: string) {
  const start = CHARACTERS.find((character) => character.id === initialCharacter);
  const [index, setIndex] = useState(() =>
    Math.max(
      CHARACTER_FORMS.findIndex((form) => form.id === (start?.form ?? initialCharacter)),
      0,
    ),
  );
  const form = CHARACTER_FORMS[index]!;
  const available = palettesFor(form);
  const [tone, setTone] = useState(() =>
    Math.max(
      available.findIndex((palette) => palette.id === (start?.palette ?? "p1")),
      0,
    ),
  );

  const step = (by: number) => {
    setIndex((current) => (current + by + CHARACTER_FORMS.length) % CHARACTER_FORMS.length);
  };

  // Forms ship different palette counts; clamp so the index can't run past the list.
  const safeTone = Math.min(tone, available.length - 1);
  const palette = available[safeTone]!;
  const character = CHARACTERS.find(
    (option) => option.form === form.id && option.palette === palette.id,
  )!;

  return { character, index, step, tone: safeTone, setTone, palette };
}

export function CharacterCarousel({
  memberName,
  index,
  step,
  tone,
  setTone,
  beat = null,
  height = 430,
}: {
  memberName: string;
  index: number;
  step: (by: number) => void;
  tone: number;
  setTone: (at: number) => void;
  beat?: CharacterBeat | null;
  height?: number;
}) {
  const reduceMotion = useReduceMotion();
  const form = CHARACTER_FORMS[index]!;
  const available = palettesFor(form);
  const palette = available[Math.min(tone, available.length - 1)]!;
  const character = CHARACTERS.find(
    (option) => option.form === form.id && option.palette === palette.id,
  )!;

  // Preload only what's one press away; all sixteen bodies is ~7MB over mobile data.
  useEffect(() => {
    for (const other of CHARACTER_FORMS) {
      const wears = palettesFor(other).some((option) => option.id === palette.id);
      preloadCharacter(variantId(other.id, wears ? palette.id : "p1"));
    }
    for (const other of available) preloadCharacter(variantId(form.id, other.id));
    // `available` is a fresh array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id, palette.id]);

  const flourish = useCatwalkFlourish(beat === null);

  return (
    <div className="relative flex flex-1 items-end justify-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 bottom-24"
        style={{ background: "radial-gradient(ellipse at 50% 26%, #ffffff 0%, var(--set-wall) 64%)" }}
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-floor" />
      <div aria-hidden className="absolute inset-x-0 bottom-24 h-0.5 bg-horizon" />

      <StepButton side="left" onClick={() => step(-1)} reduceMotion={reduceMotion} />
      <StepButton side="right" onClick={() => step(1)} reduceMotion={reduceMotion} />

      {/* floorFraction lands the feet on the horizon. */}
      <CharacterStage
        id={character.id}
        name={memberName}
        height={height}
        interactive
        fill
        heightFraction={0.62}
        floorFraction={0.2}
        social
        beat={beat ?? flourish}
        eager
      />

      <div className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1.5">
        <p className="font-display text-lg font-semibold text-ink">{character.name}</p>
        <p className="text-[11px] text-ink-muted">{character.label}</p>
        <div className="mt-1 flex gap-1.5">
          {CHARACTER_FORMS.map((option, dot) => (
            <span
              key={option.id}
              aria-hidden
              className={`size-1.5 rounded-full transition-colors ${
                dot === index ? "bg-ink" : "bg-ink-faint/40"
              }`}
            />
          ))}
        </div>

        <div className="mt-2.5 flex gap-2">
          {available.map((option, at) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTone(at)}
              aria-label={option.label}
              aria-pressed={at === tone}
              className={`size-7 overflow-hidden rounded-full transition-shadow ${
                at === tone ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-[0_0_0_1px_rgba(0,0,0,.12)]"
              }`}
            >
              <span aria-hidden className="block h-1/2 w-full" style={{ background: option.skin }} />
              <span aria-hidden className="block h-1/2 w-full" style={{ background: option.top }} />
            </button>
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

const CATWALK = { min: 12, max: 26 };

function useCatwalkFlourish(active: boolean): CharacterBeat | null {
  const reduceMotion = useReduceMotion();
  const [beat, setBeat] = useState<CharacterBeat | null>(null);
  const running = active && !reduceMotion;

  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    const gap = () => (CATWALK.min + Math.random() * (CATWALK.max - CATWALK.min)) * 1000;
    const tick = () => {
      setBeat("catwalk");
      timer = setTimeout(() => {
        setBeat(null);
        timer = setTimeout(tick, gap());
      }, 3200);
    };
    timer = setTimeout(tick, gap());
    return () => clearTimeout(timer);
  }, [running]);

  return running ? beat : null;
}

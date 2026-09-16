"use client";

import Image from "next/image";
import { m } from "motion/react";
import { useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { ContactShadow } from "@/components/studio/character";
import { CharacterStage } from "@/components/studio/character-stage";
import {
  CHARACTER_PARTS,
  CHARACTERS,
  PART_LABELS,
  PART_SWATCHES,
  characterFor,
  characterStillPath,
  type CharacterColours,
} from "@/lib/design/character";

// Nothing here persists: there is no avatar column on `Member` and no action to
// write one (O-14), so the panel says so rather than looking like a saved
// setting. Eye colour is absent by necessity, not oversight (O-15).

export function CharacterLab({ name }: { name: string }) {
  const [colours, setColours] = useState<CharacterColours>({});
  const [bodyIndex, setBodyIndex] = useState(() => {
    const chosen = characterFor(name);
    return Math.max(
      CHARACTERS.findIndex((character) => character.id === chosen.id),
      0,
    );
  });
  const reduceMotion = useReduceMotion();
  const character = CHARACTERS[bodyIndex]!;

  return (
    <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[20px] border border-surface-sunken bg-wall shadow-e2 lg:flex-row">
      <div className="relative flex flex-1 items-end justify-center overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 bottom-24"
          style={{
            background: "radial-gradient(ellipse at 50% 26%, #ffffff 0%, var(--set-wall) 64%)",
          }}
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-floor" />
        <div aria-hidden className="absolute inset-x-0 bottom-24 h-0.5 bg-horizon" />

        <p className="absolute left-7.5 top-6.5 z-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Character · Appearance
        </p>

        <div className="relative z-10 flex flex-col items-center pb-9">
          <CharacterStage id={character.id} name={name} height={430} colours={colours} eager />
          <ContactShadow width={210} height={20} className="-mt-1" />
        </div>
      </div>

      <div className="flex w-full flex-none flex-col gap-5.5 border-surface-sunken bg-surface p-7 lg:w-70 lg:border-l">
        <fieldset className="border-0 p-0">
          <div className="mb-2.5 flex items-center justify-between">
            <legend className="font-display text-base font-semibold text-ink">Character</legend>
            <span className="text-[11px] text-ink-muted">
              {bodyIndex + 1} of {CHARACTERS.length}
            </span>
          </div>

          <div role="group" aria-label="Choose a character" className="flex gap-2.5">
            {CHARACTERS.map((option, index) => {
              const isChosen = index === bodyIndex;
              return (
                <m.button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={isChosen}
                  whileHover={reduceMotion ? undefined : { scale: 1.06 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 520, damping: 18 }}
                  onClick={() => setBodyIndex(index)}
                  className={`relative size-15 flex-none overflow-hidden rounded-2xl border-2 bg-floor ${
                    isChosen ? "border-ink" : "border-transparent"
                  }`}
                >
                  <Image
                    src={characterStillPath(option.id)}
                    alt=""
                    width={60}
                    height={60}
                    style={{
                      position: "absolute",
                      top: "4%",
                      left: 0,
                      width: "100%",
                      height: "92%",
                      objectFit: "contain",
                    }}
                  />
                </m.button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[11px] text-ink-muted">
            {character.label}. Nothing is saved yet.
          </p>
        </fieldset>

        <div>
          <p className="font-display text-base font-semibold text-ink">Colours</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            Tap a swatch to repaint that part. Nothing is saved yet.
          </p>
        </div>

        {CHARACTER_PARTS.map((part) => {
          const chosen = colours[part];
          return (
            <fieldset key={part} className="border-0 p-0">
              <div className="mb-2.5 flex items-center justify-between">
                <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {PART_LABELS[part]}
                </legend>
                {chosen ? (
                  <span
                    aria-hidden
                    className="size-4 rounded-full transition-all duration-250"
                    style={{
                      background: chosen,
                      boxShadow: `0 0 0 2px var(--surface-base), 0 0 0 3px ${chosen}`,
                    }}
                  />
                ) : (
                  <span className="text-[10px] text-ink-faint">As drawn</span>
                )}
              </div>

              <div className="flex gap-2.5">
                {PART_SWATCHES[part].map((colour) => {
                  const isChosen = chosen === colour;
                  return (
                    <m.button
                      key={colour}
                      type="button"
                      aria-label={`${PART_LABELS[part]}: ${colour}`}
                      aria-pressed={isChosen}
                      whileHover={reduceMotion ? undefined : { scale: 1.18 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 520, damping: 18 }}
                      // Tapping the chosen swatch again is the only way back to
                      // the colour the character was drawn with.
                      onClick={() =>
                        setColours((current) =>
                          current[part] === colour
                            ? { ...current, [part]: undefined }
                            : { ...current, [part]: colour },
                        )
                      }
                      className={`size-6.5 rounded-full border-2 ${
                        isChosen ? "border-ink" : "border-transparent"
                      }`}
                      style={{
                        background: colour,
                        boxShadow:
                          colour === "#FFFFFF" ? "inset 0 0 0 1px var(--surface-line)" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

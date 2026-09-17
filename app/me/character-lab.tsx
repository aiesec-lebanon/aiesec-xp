"use client";

import { m } from "motion/react";
import { useCallback, useState, useTransition } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { ContactShadow } from "@/components/studio/character";
import { CharacterStage } from "@/components/studio/character-stage";
import { saveCharacter } from "@/lib/design/avatar-actions";
import {
  CHARACTER_PARTS,
  CHARACTERS,
  PART_LABELS,
  PART_SWATCHES,
  PART_TAKES_ANY_COLOUR,
  type CharacterColours,
  type CharacterPart,
} from "@/lib/design/character";

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

export function CharacterLab({
  name,
  initialCharacter,
  initialColours,
}: {
  name: string;
  initialCharacter: string;
  initialColours: CharacterColours;
}) {
  const [colours, setColours] = useState<CharacterColours>(initialColours);
  const [bodyIndex, setBodyIndex] = useState(() =>
    Math.max(
      CHARACTERS.findIndex((character) => character.id === initialCharacter),
      0,
    ),
  );
  // The colour each part is drawn with, reported by the model once it loads.
  // It is the default a member starts on, so nobody has to pick anything to end
  // up with a body that looks right.
  const [authored, setAuthored] = useState<Partial<Record<CharacterPart, string>>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const reduceMotion = useReduceMotion();
  const character = CHARACTERS[bodyIndex]!;

  const onAuthoredColours = useCallback(
    (next: Partial<Record<CharacterPart, string>>) => setAuthored(next),
    [],
  );

  const step = (by: number) => {
    setBodyIndex((current) => (current + by + CHARACTERS.length) % CHARACTERS.length);
    setStatus({ kind: "idle" });
  };

  const choose = (part: CharacterPart, colour: string | undefined) => {
    setColours((current) => ({ ...current, [part]: colour }));
    setStatus({ kind: "idle" });
  };

  const save = () => {
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const result = await saveCharacter({
        character: character.id,
        colours: Object.fromEntries(
          CHARACTER_PARTS.map((part) => [part, colours[part] ?? null]),
        ) as Record<CharacterPart, string | null>,
      });
      setStatus(result.ok ? { kind: "saved" } : { kind: "error", message: result.error });
    });
  };

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

        {/* The switcher lives on the set rather than in the panel: four
            thumbnails in a 280px column overflowed it. */}
        <StepButton side="left" onClick={() => step(-1)} reduceMotion={reduceMotion} />
        <StepButton side="right" onClick={() => step(1)} reduceMotion={reduceMotion} />

        <div className="relative z-10 flex flex-col items-center pb-9">
          <CharacterStage
            id={character.id}
            name={name}
            height={430}
            colours={colours}
            onAuthoredColours={onAuthoredColours}
            eager
          />
          <ContactShadow width={210} height={20} className="-mt-1" />
        </div>

        <div className="absolute inset-x-0 bottom-7 z-10 flex flex-col items-center gap-1.5">
          <p className="font-display text-sm font-semibold text-ink">{character.label}</p>
          <div className="flex gap-1.5">
            {CHARACTERS.map((option, index) => (
              <span
                key={option.id}
                aria-hidden
                className={`size-1.5 rounded-full transition-colors ${
                  index === bodyIndex ? "bg-ink" : "bg-ink-faint/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-none flex-col gap-5.5 border-surface-sunken bg-surface p-7 lg:w-70 lg:border-l">
        <div>
          <p className="font-display text-base font-semibold text-ink">Colours</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            Each part starts on the colour it was drawn with. Tap a swatch to
            change it, or the first one to go back.
          </p>
        </div>

        {CHARACTER_PARTS.map((part) => {
          const chosen = colours[part];
          const original = authored[part];
          const showing = chosen ?? original;
          return (
            <fieldset key={part} className="border-0 p-0">
              <div className="mb-2.5 flex items-center justify-between">
                <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {PART_LABELS[part]}
                </legend>
                {showing ? (
                  <span
                    aria-hidden
                    className="size-4 rounded-full transition-all duration-250"
                    style={{
                      background: showing,
                      boxShadow: `0 0 0 2px var(--surface-base), 0 0 0 3px ${showing}`,
                    }}
                  />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {original ? (
                  <m.button
                    type="button"
                    aria-label={`${PART_LABELS[part]}: original`}
                    aria-pressed={chosen === undefined}
                    title="The colour this character was drawn with"
                    whileHover={reduceMotion ? undefined : { scale: 1.18 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 520, damping: 18 }}
                    onClick={() => choose(part, undefined)}
                    className={`size-6.5 rounded-full border-2 ${
                      chosen === undefined ? "border-ink" : "border-transparent"
                    }`}
                    style={{ background: original, boxShadow: "inset 0 0 0 1px var(--surface-line)" }}
                  />
                ) : null}

                {PART_SWATCHES[part].map((colour) => {
                  const isChosen = chosen?.toUpperCase() === colour.toUpperCase();
                  return (
                    <m.button
                      key={colour}
                      type="button"
                      aria-label={`${PART_LABELS[part]}: ${colour}`}
                      aria-pressed={isChosen}
                      whileHover={reduceMotion ? undefined : { scale: 1.18 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 520, damping: 18 }}
                      onClick={() => choose(part, isChosen ? undefined : colour)}
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

                {PART_TAKES_ANY_COLOUR.includes(part) ? (
                  <CustomSwatch
                    part={part}
                    value={chosen}
                    onChange={(colour) => choose(part, colour)}
                  />
                ) : null}
              </div>
            </fieldset>
          );
        })}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-surface transition-opacity disabled:opacity-60"
          >
            {status.kind === "saving" || pending ? "Saving…" : "Save character"}
          </button>
          <p
            role="status"
            className={`min-h-4 text-center text-[11px] ${
              status.kind === "error" ? "text-re-ink" : "text-ink-muted"
            }`}
          >
            {status.kind === "saved"
              ? "Saved."
              : status.kind === "error"
                ? status.message
                : "This is how you appear across AIESEC XP."}
          </p>
        </div>
      </div>
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

// A garment can be any colour, so the swatches are a shortcut rather than the
// whole range. The native picker is wrapped in a label because the input itself
// cannot be styled into a round swatch.
function CustomSwatch({
  part,
  value,
  onChange,
}: {
  part: CharacterPart;
  value: string | undefined;
  onChange: (colour: string) => void;
}) {
  const isCustom =
    value !== undefined &&
    !PART_SWATCHES[part].some((swatch) => swatch.toUpperCase() === value.toUpperCase());

  return (
    <label
      className={`relative size-6.5 cursor-pointer rounded-full border-2 ${
        isCustom ? "border-ink" : "border-transparent"
      }`}
      style={{
        background: isCustom
          ? value
          : "conic-gradient(#F85A40, #FFC845, #00C16E, #037EF3, #9C6AE8, #F85A40)",
      }}
      title={`Any ${PART_LABELS[part].toLowerCase()}`}
    >
      <span className="sr-only">{`Custom ${PART_LABELS[part].toLowerCase()}`}</span>
      <input
        type="color"
        value={value ?? "#037EF3"}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}

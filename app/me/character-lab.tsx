"use client";

import { m } from "motion/react";
import { useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { Character, ContactShadow } from "@/components/studio/character";

// Appearance, as far as it can honestly go today.
//
// Nothing here persists: there is no avatar column in the schema and no action
// to write one (O-13), and the body is a flat render, so a chosen colour cannot
// repaint the part it names. What the panel does do is commit to the vocabulary
// the real editor will use -- six categories, one swatch row each -- and preview
// a choice as a tinted key light on the stage, which is exactly what the comp
// shows. It is labelled as a preview rather than dressed up as a saved setting.

type Category = {
  key: string;
  label: string;
  colours: string[];
};

const CATEGORIES: Category[] = [
  { key: "skin", label: "Skin colour", colours: ["#F7D9B8", "#E8B98A", "#C88958", "#9C6238", "#6B4226"] },
  { key: "hair", label: "Hair colour", colours: ["#2B2320", "#6B4226", "#B8752E", "#E8C88A", "#D6453D"] },
  { key: "eye", label: "Eye colour", colours: ["#4A3222", "#3D6B8C", "#4C7A4C", "#6B5A3D"] },
  { key: "shirt", label: "T-shirt colour", colours: ["#037EF3", "#00C16E", "#FFC845", "#F85A40"] },
  { key: "trouser", label: "Trouser colour", colours: ["#171614", "#4A4842", "#8F8B81", "#0B5CB8"] },
  { key: "shoe", label: "Shoe colour", colours: ["#171614", "#FFFFFF", "#F85A40", "#037EF3"] },
];

const INITIAL = Object.fromEntries(
  CATEGORIES.map((category) => [category.key, category.colours[0]!])
) as Record<string, string>;

export function CharacterLab({ name }: { name: string }) {
  const [chosen, setChosen] = useState(INITIAL);
  const [glow, setGlow] = useState<string | null>(null);
  const reduceMotion = useReduceMotion();

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

        <m.div
          aria-hidden
          animate={{ opacity: glow ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
          className="absolute bottom-21 left-1/2 size-75 -translate-x-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${glow ?? "#037EF3"}47 0%, transparent 70%)`,
          }}
        />

        <div className="relative z-10 flex flex-col items-center pb-9">
          <Character name={name} height={430} />
          <ContactShadow width={210} height={20} className="-mt-1" />
        </div>
      </div>

      <div className="flex w-full flex-none flex-col gap-5.5 border-surface-sunken bg-surface p-7 lg:w-70 lg:border-l">
        <div>
          <p className="font-display text-base font-semibold text-ink">Colours</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            Tap a swatch to preview it. Nothing is saved yet.
          </p>
        </div>

        {CATEGORIES.map((category) => (
          <fieldset key={category.key} className="border-0 p-0">
            <div className="mb-2.5 flex items-center justify-between">
              <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                {category.label}
              </legend>
              <span
                aria-hidden
                className="size-4 rounded-full transition-all duration-250"
                style={{
                  background: chosen[category.key],
                  boxShadow: `0 0 0 2px var(--surface-base), 0 0 0 3px ${chosen[category.key]}`,
                }}
              />
            </div>

            <div className="flex gap-2.5">
              {category.colours.map((colour) => {
                const isChosen = chosen[category.key] === colour;
                return (
                  <m.button
                    key={colour}
                    type="button"
                    aria-label={`${category.label}: ${colour}`}
                    aria-pressed={isChosen}
                    whileHover={reduceMotion ? undefined : { scale: 1.18 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 520, damping: 18 }}
                    onClick={() => {
                      setChosen((current) => ({ ...current, [category.key]: colour }));
                      setGlow(colour);
                    }}
                    className={`size-6.5 rounded-full border-2 ${
                      isChosen ? "border-ink" : "border-transparent"
                    }`}
                    style={{
                      background: colour,
                      boxShadow: colour === "#FFFFFF" ? "inset 0 0 0 1px var(--surface-line)" : undefined,
                    }}
                  />
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

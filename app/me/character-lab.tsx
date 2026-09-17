"use client";

import { useState, useTransition } from "react";

import { CharacterAvatar } from "@/components/studio/character";
import { CharacterCarousel, useCharacterChoice } from "@/components/studio/character-picker";
import { saveCharacter } from "@/lib/design/avatar-actions";

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

export function CharacterLab({
  name,
  initialCharacter,
}: {
  name: string;
  initialCharacter: string;
}) {
  const { character, index, step, stepped } = useCharacterChoice(initialCharacter);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const save = () => {
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const result = await saveCharacter({ character: character.id });
      setStatus(result.ok ? { kind: "saved" } : { kind: "error", message: result.error });
    });
  };

  return (
    <div className="flex min-h-[560px] flex-col overflow-hidden rounded-[20px] border border-surface-sunken bg-wall shadow-e2 lg:flex-row">
      <CharacterCarousel
        memberName={name}
        index={index}
        step={(by) => {
          step(by);
          setStatus({ kind: "idle" });
        }}
        animate={stepped}
      />

      <div className="flex w-full flex-none flex-col gap-6 border-surface-sunken bg-surface p-7 lg:w-70 lg:border-l">
        <div>
          <p className="font-display text-base font-semibold text-ink">Your character</p>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            This is who you appear as on every leaderboard.
          </p>
        </div>

        <div className="flex items-center gap-3.5">
          <CharacterAvatar name={name} idOverride={character.id} size={54} rounded="rounded-full" />
          <div>
            <p className="font-display text-base font-semibold text-ink">{character.name}</p>
            <p className="text-[11px] text-ink-muted">{character.label}</p>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2">
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
                : "Your profile picture follows your character."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Parked: the colour panel (D-52).
 *
 * Five rows of swatches -- skin, hair, top, trouser, shoe -- plus a native
 * colour picker for the garments, and an Original swatch that cleared the
 * choice. It drove `CharacterModel`'s per-part tinting, which needs the split
 * export from `scripts/assets/avatar-parts.py` to mean anything.
 *
 * const [colours, setColours] = useState<CharacterColours>(initialColours);
 * const [authored, setAuthored] = useState<Partial<Record<CharacterPart, string>>>({});
 * const onAuthoredColours = useCallback(
 *   (next: Partial<Record<CharacterPart, string>>) => setAuthored(next),
 *   [],
 * );
 *
 * const choose = (part: CharacterPart, colour: string | undefined) => {
 *   setColours((current) => ({ ...current, [part]: colour }));
 *   setStatus({ kind: "idle" });
 * };
 *
 * {CHARACTER_PARTS.map((part) => {
 *   const chosen = colours[part];
 *   const original = authored[part];
 *   const showing = chosen ?? original;
 *   return (
 *     <fieldset key={part} className="border-0 p-0">
 *       <div className="mb-2.5 flex items-center justify-between">
 *         <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
 *           {PART_LABELS[part]}
 *         </legend>
 *         {showing ? (
 *           <span
 *             aria-hidden
 *             className="size-4 rounded-full transition-all duration-250"
 *             style={{
 *               background: showing,
 *               boxShadow: `0 0 0 2px var(--surface-base), 0 0 0 3px ${showing}`,
 *             }}
 *           />
 *         ) : null}
 *       </div>
 *
 *       <div className="flex flex-wrap items-center gap-2.5">
 *         {original ? (
 *           <m.button
 *             type="button"
 *             aria-label={`${PART_LABELS[part]}: original`}
 *             aria-pressed={chosen === undefined}
 *             title="The colour this character was drawn with"
 *             onClick={() => choose(part, undefined)}
 *             className={`size-6.5 rounded-full border-2 ${
 *               chosen === undefined ? "border-ink" : "border-transparent"
 *             }`}
 *             style={{ background: original, boxShadow: "inset 0 0 0 1px var(--surface-line)" }}
 *           />
 *         ) : null}
 *
 *         {PART_SWATCHES[part].map((colour) => {
 *           const isChosen = chosen?.toUpperCase() === colour.toUpperCase();
 *           return (
 *             <m.button
 *               key={colour}
 *               type="button"
 *               aria-label={`${PART_LABELS[part]}: ${colour}`}
 *               aria-pressed={isChosen}
 *               onClick={() => choose(part, isChosen ? undefined : colour)}
 *               className={`size-6.5 rounded-full border-2 ${
 *                 isChosen ? "border-ink" : "border-transparent"
 *               }`}
 *               style={{ background: colour }}
 *             />
 *           );
 *         })}
 *
 *         {PART_TAKES_ANY_COLOUR.includes(part) ? (
 *           <CustomSwatch part={part} value={chosen} onChange={(c) => choose(part, c)} />
 *         ) : null}
 *       </div>
 *     </fieldset>
 *   );
 * })}
 *
 * // A garment can be any colour, so the swatches were a shortcut. The native
 * // picker is wrapped in a label because the input cannot be styled round.
 * function CustomSwatch({ part, value, onChange }) {
 *   const isCustom =
 *     value !== undefined &&
 *     !PART_SWATCHES[part].some((swatch) => swatch.toUpperCase() === value.toUpperCase());
 *   return (
 *     <label
 *       className={`relative size-6.5 cursor-pointer rounded-full border-2 ${
 *         isCustom ? "border-ink" : "border-transparent"
 *       }`}
 *       style={{
 *         background: isCustom
 *           ? value
 *           : "conic-gradient(#F85A40, #FFC845, #00C16E, #037EF3, #9C6AE8, #F85A40)",
 *       }}
 *     >
 *       <span className="sr-only">{`Custom ${PART_LABELS[part].toLowerCase()}`}</span>
 *       <input
 *         type="color"
 *         value={value ?? "#037EF3"}
 *         onChange={(event) => onChange(event.target.value.toUpperCase())}
 *         className="absolute inset-0 size-full cursor-pointer opacity-0"
 *       />
 *     </label>
 *   );
 * }
 * ------------------------------------------------------------------------- */

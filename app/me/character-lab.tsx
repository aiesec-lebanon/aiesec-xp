"use client";

import { useEffect, useState, useTransition } from "react";

import { CharacterAvatar } from "@/components/studio/character";
import { CharacterCarousel, useCharacterChoice } from "@/components/studio/character-picker";
import { saveCharacter } from "@/lib/design/avatar-actions";
import type { CharacterBeat } from "@/lib/design/character";

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

export function CharacterLab({
  name,
  initialCharacter,
}: {
  name: string;
  initialCharacter: string;
}) {
  const { character, index, step, tone, setTone } = useCharacterChoice(initialCharacter);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const [beat, setBeat] = useState<CharacterBeat | null>(null);

  // Back to null, so saving a second time is a second nod rather than nothing.
  useEffect(() => {
    if (!beat) return;
    const timer = setTimeout(() => setBeat(null), 2600);
    return () => clearTimeout(timer);
  }, [beat]);

  const save = () => {
    setStatus({ kind: "saving" });
    startTransition(async () => {
      const result = await saveCharacter({ character: character.id });
      setStatus(result.ok ? { kind: "saved" } : { kind: "error", message: result.error });
      // Randomised so a nod on every save doesn't read as a tic.
      if (result.ok) setBeat(Math.random() < 0.5 ? "acknowledge" : "salute");
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
          setBeat(null);
        }}
        tone={tone}
        setTone={(at) => {
          setTone(at);
          setStatus({ kind: "idle" });
          setBeat(null);
        }}
        beat={beat}
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

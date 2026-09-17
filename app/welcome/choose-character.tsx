"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CharacterCarousel, useCharacterChoice } from "@/components/studio/character-picker";
import { saveCharacter } from "@/lib/design/avatar-actions";

export function ChooseCharacter({
  name,
  initialCharacter,
}: {
  name: string;
  initialCharacter: string;
}) {
  const router = useRouter();
  const { character, index, step } = useCharacterChoice(initialCharacter);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveCharacter({ character: character.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex h-[520px] w-full max-w-[560px] overflow-hidden rounded-[22px] border border-surface-sunken bg-wall shadow-e2">
        <CharacterCarousel
          memberName={name}
          index={index}
          step={step}
            height={400}
        />
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-full bg-ink px-8 py-3 font-display text-base font-semibold text-surface transition-opacity disabled:opacity-60"
        >
          {pending ? "Saving…" : `I'm ${character.name}`}
        </button>
        <p role="status" className={`min-h-4 text-xs ${error ? "text-re-ink" : "text-ink-muted"}`}>
          {error ?? "You can change this later in the character lab."}
        </p>
      </div>
    </div>
  );
}

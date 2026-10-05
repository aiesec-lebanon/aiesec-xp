"use client";

import { useId, useTransition } from "react";

import { setReduceMotion } from "@/lib/design/motion-actions";

import { useReduceMotion } from "./motion-provider";

export function ReduceMotionToggle({ hideLabel = false }: { hideLabel?: boolean }) {
  const reduceMotion = useReduceMotion();
  const [pending, startTransition] = useTransition();
  const id = useId();

  return (
    <label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-medium text-ink-muted"
    >
      <span className="relative inline-block h-6.5 w-11 flex-none">
        <input
          id={id}
          type="checkbox"
          checked={reduceMotion}
          disabled={pending}
          onChange={(event) => {
            const next = event.currentTarget.checked;
            startTransition(() => setReduceMotion(next));
          }}
          className="peer size-full cursor-pointer appearance-none rounded-full bg-surface-sunken transition-colors checked:bg-stage-apl disabled:opacity-50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-0.75 top-0.75 size-5 rounded-full bg-surface-raised shadow-sm transition-transform duration-200 peer-checked:translate-x-4.5"
        />
      </span>
      <span className={hideLabel ? "sr-only" : undefined}>Reduce motion</span>
    </label>
  );
}

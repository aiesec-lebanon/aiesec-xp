"use client";

import { useTransition } from "react";

import { setReduceMotion } from "@/lib/design/motion-actions";

import { useReduceMotion } from "./motion-provider";

// The mechanism WCAG 2.2.2 asks for, offered as a control the member chooses
// rather than an operating-system default applied on their behalf (D-46). It
// sits in the root layout, so it is reachable from every page including before
// sign-in.
export function ReduceMotionToggle() {
  const reduceMotion = useReduceMotion();
  const [pending, startTransition] = useTransition();

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
      <input
        type="checkbox"
        checked={reduceMotion}
        disabled={pending}
        onChange={(event) => {
          const next = event.currentTarget.checked;
          startTransition(() => setReduceMotion(next));
        }}
        className="size-3.5 accent-stage-apl"
      />
      Reduce motion
    </label>
  );
}

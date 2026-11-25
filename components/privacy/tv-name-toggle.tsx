"use client";

import { useId, useState, useTransition } from "react";

import { setTvNameConsent } from "@/lib/privacy/consent-actions";

export function TvNameToggle({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [pending, startTransition] = useTransition();
  const id = useId();

  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2.5">
      <span className="relative inline-block h-6.5 w-11 flex-none">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={(event) => {
            const next = event.currentTarget.checked;
            setChecked(next);
            startTransition(() => setTvNameConsent(next));
          }}
          className="peer size-full cursor-pointer appearance-none rounded-full bg-surface-sunken transition-colors checked:bg-stage-apl disabled:opacity-50"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-0.75 top-0.75 size-5 rounded-full bg-surface-raised shadow-sm transition-transform duration-200 peer-checked:translate-x-4.5"
        />
      </span>
      <span className="sr-only">Show my name on the office screen</span>
    </label>
  );
}

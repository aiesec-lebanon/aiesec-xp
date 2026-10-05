"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { DateField } from "./date-field";

export type RangeFilterProps = {
  action: string;
  from: string;
  to: string;
  min: string;
  max: string;
  /** Params to carry through; `page` must not be one, since a new range is a new list. */
  keep?: Record<string, string>;
};

export function RangeFilter({ action, from, to, min, max, keep = {} }: RangeFilterProps) {
  const router = useRouter();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [shown, setShown] = useState({ from, to });

  // The server may clamp the range, and client-side navigation doesn't remount this.
  if (shown.from !== from || shown.to !== to) {
    setShown({ from, to });
    setStart(from);
    setEnd(to);
  }

  const dirty = start !== from || end !== to;

  // Client-side navigation so rows animate to new ranks; the GET form is the no-JS fallback.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams({ ...keep, from: start, to: end });
    router.push(`${action}?${query.toString()}`);
  }

  return (
    <form
      action={action}
      method="get"
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2.5"
      aria-label="Filter by date range"
    >
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {/* Same bounds on both fields; a reversed pair is clamped on the server. */}
      <DateField label="From" name="from" value={start} min={min} max={max} onChange={setStart} />
      <DateField label="To" name="to" value={end} min={min} max={max} onChange={setEnd} />

      <button
        type="submit"
        disabled={!dirty}
        className="rounded-[10px] bg-ink px-4.5 py-2.5 text-[13px] font-semibold text-surface shadow-e1 transition-all hover:bg-ink-secondary disabled:pointer-events-none disabled:opacity-30"
      >
        Apply
      </button>
    </form>
  );
}

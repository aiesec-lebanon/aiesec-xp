"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { DateField } from "./date-field";

// The date range a leaderboard is read over (D-58). Lives in the URL, so a
// range is something a member can send to someone else rather than something
// they have to describe.

export type RangeFilterProps = {
  /** The path submitting returns to, e.g. "/leaderboard". */
  action: string;
  from: string;
  to: string;
  /** The term start: nothing before it was collected (D-58). */
  min: string;
  max: string;
  /** Other search params to carry through, so picking dates does not clear the
   * office filter. `page` is deliberately not one of them: a different range is
   * a different list, and page 4 of it may not exist. */
  keep?: Record<string, string>;
};

export function RangeFilter({ action, from, to, min, max, keep = {} }: RangeFilterProps) {
  const router = useRouter();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [shown, setShown] = useState({ from, to });

  // The server clamps a range it will not serve, and navigation here is
  // client-side, so this component is not remounted when it does. Without this
  // the fields would keep showing dates the board is not being scored over.
  if (shown.from !== from || shown.to !== to) {
    setShown({ from, to });
    setStart(from);
    setEnd(to);
  }

  const dirty = start !== from || end !== to;

  // A real GET form underneath, so the range lands in the URL either way. This
  // only takes over to keep the navigation client-side, so the rows animate to
  // their new ranks instead of the page being replaced.
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

      {/* Both fields take the same bounds rather than each other's. Pinning
          From's max to To would mean a range could only ever be moved later by
          editing the two in the right order; a reversed pair is clamped on the
          server instead, and the fields re-sync to what was actually scored. */}
      <DateField label="From" name="from" value={start} min={min} max={max} onChange={setStart} />
      <DateField label="To" name="to" value={end} min={min} max={max} onChange={setEnd} />

      {/* Only offered once the dates differ from what is on screen: a button
          that does nothing is a button that teaches people not to trust it. */}
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

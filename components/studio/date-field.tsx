"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  WEEKDAYS,
  addDays,
  clampIso,
  formatDisplay,
  formatFull,
  isWithin,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
  type YearMonth,
} from "@/lib/design/calendar";

// A date field on this product's own surface.
//
// `<input type="date">` was the obvious thing and it is the wrong thing here:
// its calendar is browser chrome, rendered by the platform in the platform's own
// blue, and no stylesheet can reach it. Next to a warm-paper cyclorama it reads
// as a different application. So the calendar is ours, which also means it can
// refuse dates before the term start rather than merely rejecting them on submit.
//
// Keyboard behaviour follows the ARIA date-picker pattern: one tab stop into the
// grid, arrows to move, Escape to leave. 42 individually tabbable days would be
// operable and unusable, which is not what AA means.

const TRIGGER =
  "flex items-center gap-2.5 rounded-[10px] border border-line bg-surface-raised px-3.5 py-2.5 text-[13px] font-semibold text-ink shadow-e1 transition-colors hover:bg-surface-sunken";

export type DateFieldProps = {
  label: string;
  /** The form field this writes into. */
  name: string;
  value: string;
  min: string;
  max: string;
  onChange: (next: string) => void;
};

export function DateField({ label, name, value, min, max, onChange }: DateFieldProps) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  // Pointer down rather than click: a click that starts inside the popover and
  // ends outside it is a drag, not a dismissal.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={container} className="relative flex flex-col gap-1.5">
      <span
        id={`${id}-label`}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted"
      >
        {label}
      </span>

      <input type="hidden" name={name} value={value} />

      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen((was) => !was)}
        className={TRIGGER}
      >
        <span id={`${id}-value`} className="tabular">
          {formatDisplay(value)}
        </span>
        <CalendarGlyph />
      </button>

      {open ? (
        <Calendar
          label={label}
          value={value}
          min={min}
          max={max}
          onPick={(next) => {
            onChange(next);
            close(true);
          }}
          onDismiss={close}
        />
      ) : null}
    </div>
  );
}

function Calendar({
  label,
  value,
  min,
  max,
  onPick,
  onDismiss,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  onPick: (next: string) => void;
  onDismiss: (returnFocus: boolean) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(() => clampIso(value, min, max));
  const [month, setMonth] = useState<YearMonth>(() => monthOf(focused));
  // Left unless that would hang the panel off the right edge, which is exactly
  // where this filter sits on a wide screen.
  const [alignRight, setAlignRight] = useState(false);

  // True on mount, so opening puts focus in the grid -- which is what makes the
  // arrows and Escape do anything. Set again only by the key handler: moving
  // DOM focus when the month buttons change the grid would take focus off the
  // button being clicked, and one press of "next" would be all anyone could do.
  const claimFocus = useRef(true);

  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    setAlignRight(node.getBoundingClientRect().right > window.innerWidth - 8);
  }, []);

  useEffect(() => {
    if (!claimFocus.current) return;
    claimFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focused}"]`)?.focus();
  }, [focused]);

  // Paging with the keyboard has to carry the grid with it, or the focused day
  // is in a month nobody can see.
  const focusOn = (next: string) => {
    const landed = clampIso(next, min, max);
    // Already against the term boundary. Returning early matters: React would
    // bail on the identical state, the effect below would never run, and the
    // flag would sit raised until the next month click stole focus mid-press.
    if (landed === focused) return;

    claimFocus.current = true;
    setFocused(landed);
    setMonth(monthOf(landed));
  };

  // Clicking through months leaves the focused day behind, so it is carried to
  // the first selectable day of wherever we land -- without stealing focus.
  const goMonth = (delta: number) => {
    const next = shiftMonth(month, delta);
    const cells = monthGrid(next);
    const landing =
      cells.find((cell) => cell.inMonth && isWithin(cell.iso, min, max)) ??
      cells.find((cell) => isWithin(cell.iso, min, max));

    setMonth(next);
    if (landing) setFocused(landing.iso);
  };

  function onKeyDown(event: React.KeyboardEvent) {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss(true);
      return;
    }
    if (event.key in step) {
      event.preventDefault();
      focusOn(addDays(focused, step[event.key]));
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const shifted = shiftMonth(monthOf(focused), event.key === "PageUp" ? -1 : 1);
      const day = Number(focused.slice(8));
      const candidate = monthGrid(shifted).find((cell) => cell.inMonth && cell.day === day);
      // A 31st that the next month does not have falls to its last day.
      focusOn(candidate?.iso ?? monthGrid(shifted).filter((cell) => cell.inMonth).at(-1)!.iso);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const weekday = monthGrid(monthOf(focused)).findIndex((cell) => cell.iso === focused) % 7;
      focusOn(addDays(focused, event.key === "Home" ? -weekday : 6 - weekday));
    }
  }

  const days = monthGrid(month);

  // A month is a dead end when none of its own days are selectable. Testing the
  // whole grid instead would keep the arrow live for a July whose only in-range
  // cells are the August days it borrows.
  const deadEnd = (delta: number) =>
    !monthGrid(shiftMonth(month, delta)).some(
      (cell) => cell.inMonth && isWithin(cell.iso, min, max)
    );

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={`Choose the ${label.toLowerCase()} date`}
      onKeyDown={onKeyDown}
      className={`absolute top-full z-30 mt-2 w-[278px] rounded-[20px] bg-surface-raised p-4 shadow-e3 ${
        alignRight ? "right-0" : "left-0"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Step
          label="Previous month"
          disabled={deadEnd(-1)}
          onClick={() => goMonth(-1)}
        >
          <Chevron direction="left" />
        </Step>

        <p aria-live="polite" className="font-display text-[15px] font-semibold text-ink">
          {monthLabel(month)}
        </p>

        <Step
          label="Next month"
          disabled={deadEnd(1)}
          onClick={() => goMonth(1)}
        >
          <Chevron direction="right" />
        </Step>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            aria-hidden
            className="py-1 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint"
          >
            {weekday}
          </span>
        ))}
      </div>

      <div ref={grid} className="grid grid-cols-7 gap-0.5">
        {days.map((cell) => (
          <Day
            key={cell.iso}
            cell={cell}
            selected={cell.iso === value}
            focused={cell.iso === focused}
            disabled={!isWithin(cell.iso, min, max)}
            onPick={onPick}
            onFocus={() => setFocused(cell.iso)}
          />
        ))}
      </div>
    </div>
  );
}

function Day({
  cell,
  selected,
  focused,
  disabled,
  onPick,
  onFocus,
}: {
  cell: { iso: string; day: number; inMonth: boolean };
  selected: boolean;
  focused: boolean;
  disabled: boolean;
  onPick: (iso: string) => void;
  onFocus: () => void;
}) {
  const tone = selected
    ? "bg-ink font-bold text-surface"
    : cell.inMonth
      ? "font-semibold text-ink hover:bg-surface-sunken"
      : "text-ink-faint hover:bg-surface-sunken";

  return (
    <button
      type="button"
      // One tab stop for the whole grid, moved by the arrow keys. 42 tabbable
      // days would be operable and unusable, which is not what AA means.
      tabIndex={focused ? 0 : -1}
      data-iso={cell.iso}
      disabled={disabled}
      aria-label={formatFull(cell.iso)}
      aria-current={selected ? "date" : undefined}
      onFocus={onFocus}
      onClick={() => onPick(cell.iso)}
      className={`tabular h-9 rounded-[10px] text-[13px] transition-colors disabled:pointer-events-none disabled:opacity-25 ${tone}`}
    >
      {cell.day}
    </button>
  );
}

function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-[10px] text-ink-secondary transition-colors hover:bg-surface-sunken disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor">
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4 text-ink-faint"
      fill="none"
      stroke="currentColor"
    >
      <rect x="3" y="5" width="18" height="16" rx="3" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

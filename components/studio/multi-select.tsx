"use client";

import { useEffect, useId, useRef, useState } from "react";

export type MultiOption = { value: string; label: string };

// A disclosure with native checkboxes rather than a listbox: picking several
// values is what checkboxes already do, with keyboard and screen reader support
// for free. Nothing picked means no filter.
export function MultiSelect({
  options,
  value,
  onChange,
  label,
  allLabel,
  className = "",
}: {
  options: readonly MultiOption[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** What is being chosen, for assistive technology: "Status". */
  label: string;
  /** Shown while nothing is picked: "All statuses". */
  allLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  const picked = options.filter((option) => value.includes(option.value));
  const summary =
    picked.length === 0
      ? allLabel
      : picked.length === 1
        ? picked[0]!.label
        : `${picked[0]!.label} +${picked.length - 1}`;

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((entry) => entry !== optionValue)
        : options.map((option) => option.value).filter((entry) => entry === optionValue || value.includes(entry))
    );
  }

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}: ${picked.length === 0 ? allLabel : picked.map((option) => option.label).join(", ")}`}
        onClick={() => setOpen((was) => !was)}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-surface"
      >
        <span className="truncate">{summary}</span>
        <svg aria-hidden viewBox="0 0 12 12" className="size-3 flex-none text-ink-faint">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute left-0 top-full z-30 mt-1.5 w-full min-w-56 rounded-xl border border-line bg-surface-raised p-1.5 shadow-e2"
        >
          <fieldset>
            <legend className="sr-only">{label}</legend>
            <div className="max-h-64 overflow-y-auto">
              {options.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-secondary hover:bg-surface-sunken hover:text-ink has-checked:font-semibold has-checked:text-ink"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(option.value)}
                    onChange={() => toggle(option.value)}
                    className="size-3.5 accent-ink"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          {value.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-lg border-t border-line px-2.5 pb-1 pt-2 text-left text-xs font-semibold text-ink-secondary hover:text-ink"
            >
              Clear ({value.length})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

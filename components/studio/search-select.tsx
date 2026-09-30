"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

// A select with a search box, for lists too long to scroll: forty members, or
// every manager on the assignment console. It follows the ARIA combobox
// pattern -- focus stays in the search input and the arrow keys move a virtual
// cursor through the listbox -- because a native <select> has no filter, and
// typeahead on it only matches the first letters of a name.

export type SearchOption = {
  value: string;
  label: string;
  /** Shown beside the label and searched with it, e.g. a role. */
  hint?: string;
};

function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function SearchSelect({
  options,
  value,
  onChange,
  label,
  placeholder = "Select",
  searchPlaceholder = "Search…",
  name,
  emptyText = "No match",
  disabled = false,
  className = "",
  buttonClassName = "",
}: {
  options: readonly SearchOption[];
  value: string;
  onChange: (value: string) => void;
  /** What is being chosen, for assistive technology: "Manager", "Credit EP 123 to". */
  label: string;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Submits the value with a form when set. */
  name?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const selected = options.find((option) => option.value === value) ?? null;

  const matches = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return options;
    return options.filter((option) => fold(`${option.label} ${option.hint ?? ""}`).includes(needle));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  function show() {
    setQuery("");
    setCursor(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function choose(option: SearchOption | undefined) {
    if (!option) return;
    onChange(option.value);
    close(true);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    const last = matches.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setCursor((index) => Math.min(index + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        setCursor((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setCursor(0);
        break;
      case "End":
        event.preventDefault();
        setCursor(Math.max(last, 0));
        break;
      case "Enter":
        // A search box inside a form would otherwise submit it.
        event.preventDefault();
        choose(matches[cursor]);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show();
          }
        }}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-surface disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={`truncate ${selected ? "" : "text-ink-secondary"}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg aria-hidden viewBox="0 0 12 12" className="size-3 flex-none text-ink-faint">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-full min-w-64 rounded-xl border border-line bg-surface-raised p-1.5 shadow-e2">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={`Search ${label.toLowerCase()}`}
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={matches[cursor] ? optionId(cursor) : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={onSearchKey}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-ink-faint"
          />

          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="mt-1 max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <li className="px-2.5 py-2 text-[13px] text-ink-faint">{emptyText}</li>
            ) : (
              matches.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={option.value === value}
                  data-index={index}
                  // Keeps focus in the search box, so choosing does not blur it first.
                  onPointerDown={(event) => event.preventDefault()}
                  onPointerMove={() => setCursor(index)}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] ${
                    index === cursor ? "bg-surface-sunken text-ink" : "text-ink-secondary"
                  } ${option.value === value ? "font-semibold text-ink" : ""}`}
                >
                  <span className="truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="flex-none font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
                      {option.hint}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

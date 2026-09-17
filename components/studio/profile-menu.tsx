"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";

import { CharacterAvatar } from "./character";

// Hover opens it, but hover is never the only way in: the caret is a real
// button, so the menu also answers a click, Enter, Space and the keyboard --
// and exists at all on a touch screen, where there is no hover to give.
const OPEN_DELAY = 120;
const CLOSE_DELAY = 260;

export function ProfileMenu({
  name,
  short,
  isAdmin = false,
  characterId,
}: {
  name: string;
  short?: string;
  isAdmin?: boolean;
  characterId?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();
  const reduceMotion = useReduceMotion();

  const schedule = (next: boolean, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  };

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onMouseEnter={() => isAdmin && schedule(true, OPEN_DELAY)}
      onMouseLeave={() => isAdmin && schedule(false, CLOSE_DELAY)}
    >
      <div className="control-surface flex items-center gap-1 rounded-full bg-surface-raised py-1.5 pl-2 pr-1.5 shadow-e1">
        <Link href="/me" className="flex items-center gap-2.5 rounded-full pr-1.5">
          <CharacterAvatar
            name={name}
            idOverride={characterId}
            size={26}
            rounded="rounded-full"
            tone="bg-re-wash"
          />
          <span className="text-[13px] font-semibold text-ink">{short ?? name}</span>
        </Link>

        {isAdmin ? (
          <button
            ref={trigger}
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={`${name}'s account menu`}
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setOpen((current) => !current);
            }}
            className="grid size-6 place-items-center rounded-full text-ink-faint transition-colors duration-[var(--motion-micro)] hover:bg-surface-sunken hover:text-ink"
          >
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className={`size-3 transition-transform duration-[var(--motion-ui)] ease-[var(--motion-ease)] ${open ? "rotate-180" : ""}`}
            >
              <path
                d="M5 7.5l5 5 5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {isAdmin && open ? (
          <m.div
            id={menuId}
            role="menu"
            aria-label={`${name}'s account`}
            initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ transformOrigin: "top right" }}
            // Padding rather than an offset: an 8px gap between the pill and the
            // panel is 8px of nothing for the pointer to cross, and crossing it
            // used to close the menu before it could be clicked.
            className="absolute right-0 top-full z-40 w-52 pt-2"
          >
            <div className="overflow-hidden rounded-2xl bg-surface-raised p-1.5 shadow-e3 ring-1 ring-surface-sunken">
              <MenuLink href="/admin/assignments" onNavigate={() => setOpen(false)}>
                Assignments
              </MenuLink>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="block rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-ink-secondary transition-colors duration-[var(--motion-micro)] hover:bg-surface-sunken hover:text-ink"
    >
      {children}
    </Link>
  );
}

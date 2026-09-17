"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { CharacterAvatar } from "./character";

/**
 * The profile pill, expanded into the member's own console links. Admin and
 * History used to be separate buttons on the chrome; folding them here keeps
 * the header to two controls -- this and sign out -- on every screen.
 */
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2.5 rounded-full bg-surface-raised py-1.5 pl-2 pr-3.5 shadow-e1 transition-colors hover:bg-surface-sunken"
      >
        <CharacterAvatar
          name={name}
          idOverride={characterId}
          size={26}
          rounded="rounded-full"
          tone="bg-re-wash"
        />
        <span className="text-[13px] font-semibold text-ink">{short ?? name}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`size-3 text-ink-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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

      {open ? (
        <div
          role="menu"
          aria-label={`${name}'s account`}
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-52 overflow-hidden rounded-2xl bg-surface-raised py-1.5 shadow-e3"
        >
          <MenuLink href="/me" onNavigate={() => setOpen(false)}>
            History
          </MenuLink>
          {isAdmin ? (
            <MenuLink href="/admin/assignments" onNavigate={() => setOpen(false)}>
              Admin
            </MenuLink>
          ) : null}
        </div>
      ) : null}
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
      className="block px-4 py-2.5 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
    >
      {children}
    </Link>
  );
}

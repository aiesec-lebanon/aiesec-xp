"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { CharacterAvatar } from "./character";

/**
 * The profile pill. The pill itself is a link to the member's own console at
 * `/me`; the caret only appears for admins, opening on hover to reveal the
 * admin console link.
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

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href="/me"
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
        {isAdmin ? (
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
        ) : null}
      </Link>

      {isAdmin && open ? (
        <div
          role="menu"
          aria-label={`${name}'s account`}
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-52 overflow-hidden rounded-2xl bg-surface-raised py-1.5 shadow-e3"
        >
          <MenuLink href="/admin/assignments" onNavigate={() => setOpen(false)}>
            Admin
          </MenuLink>
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Members" },
  { href: "/leaderboard/lcs", label: "LCs" },
] as const;

export function Dock() {
  const pathname = usePathname();
  const active =
    TABS.filter((tab) => tab.href !== "/" && pathname.startsWith(tab.href)).at(-1)?.href ??
    (pathname === "/" ? "/" : null);

  return (
    <nav
      aria-label="Sections"
      className="flex gap-1 rounded-full bg-surface-raised/85 p-1.5 shadow-e2 ring-1 ring-surface-sunken backdrop-blur-md"
    >
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-4.5 py-2.5 text-[13px] transition-[background-color,color] duration-[var(--motion-ui)] ease-[var(--motion-ease)] ${
              isActive
                ? "bg-ink font-semibold text-surface"
                : "font-medium text-ink-secondary hover:bg-surface-sunken"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

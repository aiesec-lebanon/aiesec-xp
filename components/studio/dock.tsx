"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The floating dock. Deliberately not a Motion component: the provider loads
// only Motion's DOM animation features, not its layout projection, so a shared
// `layoutId` lozenge would render without the slide that justifies it. A CSS
// colour transition is what this direction asks for anyway -- nothing animates
// except the idle breath and what you touch.

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
      // Translucent with a blur: the dock floats over a scrolling page, and a
      // solid pill let the text underneath read through it as if it were part
      // of the same line.
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

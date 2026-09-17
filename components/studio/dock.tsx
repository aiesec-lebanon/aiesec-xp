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
    TABS.filter((tab) => tab.href !== "/" && pathname.startsWith(tab.href)).at(-1)?.href ?? "/";

  return (
    <nav aria-label="Sections" className="flex gap-1 rounded-full bg-surface-raised p-1.5 shadow-e2">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-4.5 py-2.5 text-[13px] transition-colors duration-300 ${
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

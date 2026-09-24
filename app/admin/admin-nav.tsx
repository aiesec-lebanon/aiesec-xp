import Link from "next/link";

const SECTIONS = [
  { key: "assignments", href: "/admin/assignments", label: "Assignments" },
  { key: "window", href: "/admin/window", label: "Window" },
  { key: "rewards", href: "/admin/rewards", label: "Rewards" },
  { key: "sync", href: "/admin/sync", label: "Sync" },
] as const;

export type AdminSection = (typeof SECTIONS)[number]["key"];

export function AdminNav({ active }: { active: AdminSection }) {
  return (
    <nav aria-label="Admin sections" className="flex gap-0.5 rounded-xl bg-surface-raised p-1">
      {SECTIONS.map((section) => (
        <Link
          key={section.key}
          href={section.href}
          aria-current={section.key === active ? "page" : undefined}
          className={
            section.key === active
              ? "rounded-[9px] bg-surface-sunken px-4 py-2 text-[13px] font-semibold text-ink"
              : "rounded-[9px] px-4 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-sunken/60"
          }
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}

import Link from "next/link";

import { CharacterAvatar } from "./character";

export function BrandMark({ size = 30, type = 19 }: { size?: number; type?: number }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span
        aria-hidden
        style={{ width: size, height: size, borderRadius: size / 3 }}
        className="block bg-stage-apl"
      />
      <span style={{ fontSize: type }} className="font-display font-semibold text-ink">
        AIESEC XP
      </span>
    </Link>
  );
}

export function SignOutButton({ full = false }: { full?: boolean }) {
  return (
    <form action="/api/auth/logout" method="post" className={full ? "w-full" : undefined}>
      <button
        type="submit"
        className={
          full
            ? "w-full rounded-2xl bg-stage-apl px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-apl-ink"
            : "rounded-full bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-ink-secondary shadow-e1 transition-colors hover:bg-ink hover:text-surface"
        }
      >
        Sign out
      </button>
    </form>
  );
}

export function MemberPill({ name, short }: { name: string; short?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-full bg-surface-raised py-1.5 pl-2 pr-4 shadow-e1">
      <CharacterAvatar name={name} size={26} rounded="rounded-full" tone="bg-re-wash" />
      <span className="text-[13px] font-semibold text-ink">{short ?? name}</span>
    </div>
  );
}

/** The bar every member-facing screen opens with. */
export function TopBar({
  name,
  short,
  isAdmin = false,
  aside,
}: {
  name?: string;
  short?: string;
  isAdmin?: boolean;
  /** Replaces the member pill where a screen reports a count instead. */
  aside?: React.ReactNode;
}) {
  return (
    <div className="z-10 flex items-center justify-between gap-4">
      <BrandMark />
      {aside ?? (
        <div className="flex items-center gap-2.5">
          {/* The dock carries the four member-facing sections and nothing else,
              so the admin console hangs off the chrome instead of widening it
              for a link most members would never see. */}
          {isAdmin ? (
            <Link
              href="/admin/assignments"
              className="rounded-full bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-ink-secondary shadow-e1 transition-colors hover:bg-surface-sunken"
            >
              Admin
            </Link>
          ) : null}
          {name ? <MemberPill name={name} short={short} /> : null}
          <SignOutButton />
        </div>
      )}
    </div>
  );
}

export function WindowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block rounded-full bg-surface-raised px-4.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-secondary shadow-e1">
      {children}
    </div>
  );
}

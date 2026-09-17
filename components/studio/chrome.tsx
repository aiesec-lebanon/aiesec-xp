import Link from "next/link";

import type { CurrentUser } from "@/lib/auth/current-user";

import { ProfileMenu } from "./profile-menu";

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
            : "rounded-full bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-ink-secondary shadow-e1 transition-colors hover:bg-stage-apl hover:text-white"
        }
      >
        Sign out
      </button>
    </form>
  );
}

/**
 * The bar every member-facing screen opens with: the logo, the member's own
 * console (history, and admin where it applies) behind the profile pill, and
 * sign out. Rendered once from the root layout rather than per page, so it is
 * never missing and never drifts between screens.
 *
 * Absent for a visitor with no session and for `DENIED`: neither has a
 * console to open, and each of those screens carries its own sign-in or
 * sign-out affordance already.
 */
export function Header({
  user,
  characterId,
}: {
  user: CurrentUser | null;
  characterId?: string;
}) {
  if (!user || user.role === "DENIED") return null;

  return (
    <header className="relative z-30 flex items-center justify-between gap-4 px-6 pt-8 sm:px-11">
      <BrandMark />
      <div className="flex items-center gap-2.5">
        <ProfileMenu
          name={user.fullName}
          short={user.fullName.split(" ")[0] ?? user.fullName}
          isAdmin={user.role === "ADMIN"}
          characterId={characterId}
        />
        <SignOutButton />
      </div>
    </header>
  );
}

export function WindowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block rounded-full bg-surface-raised px-4.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-secondary shadow-e1">
      {children}
    </div>
  );
}

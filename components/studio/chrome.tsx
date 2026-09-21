import Link from "next/link";

import type { CurrentUser } from "@/lib/auth/current-user";

import { DockSlot } from "./dock-slot";
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
            : "control-surface rounded-full bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-ink-secondary shadow-e1 hover:text-ink"
        }
      >
        Sign out
      </button>
    </form>
  );
}

/**
 * The bar every member-facing screen opens with: the logo, the profile pill
 * (its hover dropdown holding Profile, and Admin where it applies), and sign
 * out. Rendered once from the root layout rather than per page, so it is
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
    <header className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 pb-1 pt-5 sm:px-11">
      <BrandMark />

      {/* The dock lives up here with the rest of the chrome. At the bottom of
          the screen it was a lozenge floating over the end of every page, which
          worked on a leaderboard and sat awkwardly on everything else. On a
          narrow screen it drops to its own line under the brand rather than
          squeezing the profile pill off the edge. */}
      <div className="order-3 flex w-full justify-center sm:order-2 sm:w-auto">
        <DockSlot />
      </div>

      <div className="order-2 flex items-center gap-2.5 sm:order-3">
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

/**
 * The one line at the foot of every screen. Deliberately quiet: it is a
 * signature, not a navigation surface, and it is the last thing that should
 * compete with a member's own score.
 */
export function SiteFooter() {
  return (
    <footer className="shrink-0 px-6 pb-2 pt-2 text-center sm:px-11">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        Proudly presented by AIESEC in Lebanon
      </p>
    </footer>
  );
}

export function WindowLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block rounded-full bg-surface-raised px-4.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-secondary shadow-e1">
      {children}
    </div>
  );
}

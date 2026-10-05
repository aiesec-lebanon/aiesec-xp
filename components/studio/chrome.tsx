import Link from "next/link";

import type { CurrentUser } from "@/lib/auth/current-user";
import { firstName } from "@/lib/design/names";

import { BrandGlyph } from "./brand-glyph";
import { DockSlot } from "./dock-slot";
import { ProfileMenu } from "./profile-menu";

export function BrandMark({ size = 30, type = 19 }: { size?: number; type?: number }) {
  return (
    <Link href="/" className="flex items-center gap-3">
      <BrandGlyph size={size} />
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

      <div className="order-3 flex w-full justify-center sm:order-2 sm:w-auto">
        <DockSlot />
      </div>

      <div className="order-2 flex items-center gap-2.5 sm:order-3">
        <ProfileMenu
          name={user.fullName}
          short={firstName(user.fullName)}
          isAdmin={user.role === "ADMIN"}
          characterId={characterId}
        />
        <SignOutButton />
      </div>
    </header>
  );
}

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

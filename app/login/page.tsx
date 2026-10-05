import { safeReturnTo } from "@/lib/auth/oauth";

import { BrandGlyph } from "@/components/studio/brand-glyph";
import { BrandMark } from "@/components/studio/chrome";
import { CharacterGroup } from "@/components/studio/character-group";
import { Rise } from "@/components/studio/motion";
import { characterFor } from "@/lib/design/character";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, { headline: string; detail: string }> = {
  denied_at_aiesec: { headline: "Sign-in was cancelled.", detail: "Sign in again when you're ready." },
  missing_code: {
    headline: "We couldn't finish signing you in.",
    detail: "Please sign in again.",
  },
  missing_state: { headline: "Your sign-in took too long.", detail: "Please sign in again." },
  state_mismatch: {
    headline: "We couldn't finish signing you in.",
    detail: "Please sign in again.",
  },
  gis_unavailable: { headline: "AIESEC isn't responding.", detail: "Try again in a few minutes." },
  session_unavailable: {
    headline: "Sign-in isn't working right now.",
    detail: "It's a problem on our side. Let the MCVP IM know.",
  },
};

// Nobody is signed in yet, so the bodies are named for their position on the set.
const LEFT: readonly string[] = ["Group A1", "Group A2", "Group A3"];
const RIGHT: readonly string[] = ["Group B1", "Group B2", "Group B3"];

function sideMembers(names: readonly string[]) {
  return names.map((name) => ({ id: characterFor(name).id, name }));
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const error = params.error
    ? (ERRORS[params.error] ?? { headline: "We couldn't sign you in.", detail: "Please try again." })
    : null;

  return (
    <main className="relative flex min-h-full shrink-0 flex-col overflow-hidden bg-wall">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[26%] bg-floor" />
        <div className="absolute inset-x-0 bottom-[26%] h-0.5 bg-horizon" />
      </div>

      <div className="relative z-20 px-6 pt-8 sm:px-11">
        <BrandMark size={28} type={18} />
      </div>

      {/* Hidden below `lg` to spare phones the extra WebGL contexts. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-0 hidden w-[38%] lg:block">
        <CharacterGroup members={sideMembers(LEFT)} mood="calm" heightFraction={0.62} floorFraction={0.06} />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden w-[38%] lg:block">
        <CharacterGroup members={sideMembers(RIGHT)} mood="calm" heightFraction={0.62} floorFraction={0.06} />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[700px] max-w-full -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(251,250,248,.94) 0%, rgba(251,250,248,0) 72%)",
        }}
      />

      <div className="relative z-30 flex flex-1 items-center justify-center px-6 py-12">
        <Rise className="w-full max-w-110">
          <div className="rounded-3xl bg-surface-raised px-8 py-9 text-center shadow-e3">
            <div className="mb-5 inline-flex items-center gap-2.5">
              <BrandGlyph size={26} />
              <span className="font-display text-lg font-semibold text-ink">AIESEC XP</span>
            </div>

            <h1 className="font-display text-[26px] font-semibold leading-tight text-ink">
              Pick up where you left off
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">
              Your points, your rank and the rewards closest to you. Signing in uses your AIESEC
              account only.
            </p>

            {error ? (
              <div
                role="alert"
                className="mt-5 flex items-center gap-3 rounded-2xl bg-break-ink px-4 py-3.5 text-left"
              >
                <span
                  aria-hidden
                  className="flex size-6 flex-none items-center justify-center rounded-full bg-wall text-sm font-extrabold text-break-ink"
                >
                  !
                </span>
                <p className="text-[13px] leading-snug text-wall">
                  <span className="font-bold">{error.headline}</span> {error.detail}
                </p>
              </div>
            ) : null}

            {/* Plain anchor, not next/link: the handler sets a cookie and redirects
                cross-origin, which a client-side navigation doesn't survive. */}
            <a
              href={`/api/auth/start?returnTo=${encodeURIComponent(returnTo)}`}
              className="mt-4.5 block rounded-2xl bg-stage-apl px-4 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-apl-ink"
            >
              Sign in with AIESEC
            </a>
          </div>
        </Rise>
      </div>
    </main>
  );
}

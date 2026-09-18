import { safeReturnTo } from "@/lib/auth/oauth";

import { Character, ContactShadow } from "@/components/studio/character";
import { BrandMark } from "@/components/studio/chrome";
import { LoginBody } from "@/components/studio/login-body";
import { Rise } from "@/components/studio/motion";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, { headline: string; detail: string }> = {
  denied_at_aiesec: { headline: "Sign-in was cancelled.", detail: "Try again below." },
  missing_code: {
    headline: "AIESEC did not return an authorization code.",
    detail: "Start again below.",
  },
  missing_state: { headline: "Sign-in link expired.", detail: "Request a new one below." },
  state_mismatch: {
    headline: "Sign-in link could not be verified.",
    detail: "Start again below.",
  },
  gis_unavailable: { headline: "AIESEC could not be reached.", detail: "Try again in a moment." },
  session_unavailable: {
    headline: "Signed in, but no session could start.",
    detail: "This app's SESSION_SECRET is missing or too short. Tell the MCVP IM.",
  },
};

// Three bodies to a side, back to the camera's left and right, so the middle of
// the frame stays empty for the card. They are not the visitor -- nobody is
// signed in yet -- so they are named for their position on the set.
const LEFT = ["Group A1", "Group A2", "Group A3"];
const RIGHT = ["Group B1", "Group B2", "Group B3"];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const error = params.error
    ? (ERRORS[params.error] ?? { headline: "Sign-in failed.", detail: "Try again below." })
    : null;

  return (
    <main className="relative flex min-h-full flex-col overflow-hidden bg-wall">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[26%] bg-floor" />
        <div className="absolute inset-x-0 bottom-[26%] h-0.5 bg-horizon" />
      </div>

      <div className="relative z-20 px-6 pt-8 sm:px-11">
        <BrandMark size={28} type={18} />
      </div>

      <CharacterGroup names={LEFT} side="left" />
      <CharacterGroup names={RIGHT} side="right" />

      {/* The scrim the card sits on. Without it the bodies read straight through
          the copy at narrow widths, which is exactly what this pass fixed. */}
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
              <span aria-hidden className="block size-6.5 rounded-[9px] bg-stage-apl" />
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

            {/*
              A plain anchor, not next/link. Link routes client-side, and this
              target is a route handler that sets a cookie and redirects to
              another origin -- neither of which survives a client-side
              navigation reliably. The browser has to make this request itself.
            */}
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

function CharacterGroup({ names, side }: { names: string[]; side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute bottom-0 z-0 hidden items-end lg:flex ${
        side === "left" ? "left-5" : "right-5"
      }`}
    >
      <ContactShadow
        width={440}
        height={60}
        opacity={0.16}
        className="absolute bottom-0 left-0 right-0"
      />
      <div className="-mr-10">
        <Character name={names[0]!} height={380} idle="small" />
      </div>
      {/* Only the tall one in each group is a canvas: six would be six WebGL
          contexts on a sign-in screen -- which is also why this is an idle/calm
          mood flourish (D-60) rather than the LC leaderboard's conversational
          "group" behaviour, which needs at least two live bodies to trade
          glances with. */}
      <div className="relative z-10">
        <LoginBody name={names[1]!} height={520} />
      </div>
      <div className="-ml-10">
        <Character name={names[2]!} height={380} idle="small" />
      </div>
    </div>
  );
}

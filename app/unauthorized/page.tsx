import { currentUser } from "@/lib/auth/current-user";

import { Character } from "@/components/studio/character";
import { BrandMark, SignOutButton } from "@/components/studio/chrome";
import { Rise } from "@/components/studio/motion";

export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  // Reached only with a valid session, so there is a name to greet -- but the
  // page has to render for a visitor whose session has since gone as well.
  const user = await currentUser();
  const name = user?.fullName ?? "Visitor";

  return (
    <main className="relative flex min-h-full flex-col overflow-hidden bg-wall">
      <div className="relative z-20 px-6 pt-8 sm:px-11">
        <BrandMark size={28} type={18} />
      </div>

      {/* The body stands behind the sheet, so only its head and shoulders clear
          the top edge -- the whole point of the composition is that the member
          is half in the room. */}
      <div className="pointer-events-none absolute inset-x-0 top-40 z-0 flex justify-center">
        <Character name={name} height={480} idle="squash" />
      </div>

      <Rise
        distance={28}
        className="relative z-10 mt-auto flex justify-center rounded-t-[32px] bg-surface-raised px-6 pb-12 pt-13"
        style={{ boxShadow: "0 -4px 8px rgba(23,22,20,.04), 0 -24px 56px rgba(23,22,20,.10)" }}
      >
        <div className="w-full max-w-110 text-center">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pl-3 pr-4">
            <span aria-hidden className="size-2 rounded-full bg-stage-re" />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink">
              Signed in, no position
            </span>
          </p>

          <h1 className="font-display text-2xl font-semibold leading-tight text-ink">
            We know who you are, not where you sit
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            AIESEC XP is for members of AIESEC in Lebanon. Your account holds no active position in
            an operating office, so there is nothing to show yet.
          </p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-secondary">
            Ask your LCP or the MCVP IM to check your position in EXPA.
          </p>

          <div className="mt-5">
            <SignOutButton full />
          </div>
        </div>
      </Rise>
    </main>
  );
}

import { currentUser } from "@/lib/auth/current-user";

import { Character } from "@/components/studio/character";
import { BrandMark, SignOutButton } from "@/components/studio/chrome";
import { Rise } from "@/components/studio/motion";

export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  // The session may have expired since the redirect here.
  const user = await currentUser();
  const name = user?.fullName ?? "Visitor";

  return (
    <main className="relative flex min-h-full shrink-0 flex-col overflow-hidden bg-wall">
      <div className="relative z-20 px-6 pt-8 sm:px-11">
        <BrandMark size={28} type={18} />
      </div>

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
              No member position found
            </span>
          </p>

          <h1 className="font-display text-2xl font-semibold leading-tight text-ink">
            You&rsquo;re signed in, but we can&rsquo;t find your position
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            AIESEC XP is for members of AIESEC in Lebanon. Your EXPA account doesn&rsquo;t show a
            current position in an LC or the MC, so there&rsquo;s nothing to show you yet.
          </p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-secondary">
            Ask your LCP or the MCVP IM to add your position in EXPA, then sign in again.
          </p>

          <div className="mt-5">
            <SignOutButton full />
          </div>
        </div>
      </Rise>
    </main>
  );
}

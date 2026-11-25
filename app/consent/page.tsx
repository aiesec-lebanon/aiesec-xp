import { requireMemberPage } from "@/lib/auth/guards";
import { safeReturnTo } from "@/lib/auth/oauth";
import { answerTvConsent } from "@/lib/privacy/consent-actions";
import { TV_CONSENT_TEXT } from "@/lib/privacy/tv-consent";

export const dynamic = "force-dynamic";

const CHOICE =
  "min-h-11 flex-1 rounded-full border border-line bg-surface-raised px-6 text-sm font-semibold text-ink shadow-e1 transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireMemberPage("/consent");
  const returnTo = safeReturnTo((await searchParams).returnTo);

  return (
    <main className="flex min-h-full shrink-0 flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex max-w-[46ch] flex-col items-center gap-3 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          One question first
        </p>
        <h1 className="font-display text-3xl font-semibold text-ink">{TV_CONSENT_TEXT.title}</h1>
        {TV_CONSENT_TEXT.body.map((line) => (
          <p key={line} className="text-sm text-ink-secondary">
            {line}
          </p>
        ))}
      </div>

      {/* Two equal answers: saying no is exactly as easy as saying yes. */}
      <form action={answerTvConsent} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" name="consent" value="yes" className={CHOICE}>
          Show my name
        </button>
        <button type="submit" name="consent" value="no" className={CHOICE}>
          Don&apos;t show my name
        </button>
      </form>
    </main>
  );
}

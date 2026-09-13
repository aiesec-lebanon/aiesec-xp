import Link from "next/link";

import { safeReturnTo } from "@/lib/auth/oauth";

const ERRORS: Record<string, string> = {
  denied_at_aiesec: "Sign-in was cancelled at AIESEC.",
  missing_code: "AIESEC did not return an authorization code.",
  missing_state: "That sign-in link has expired. Start again.",
  state_mismatch: "That sign-in link could not be verified. Start again.",
  gis_unavailable: "AIESEC could not be reached. Try again in a moment.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const error = params.error ? (ERRORS[params.error] ?? "Sign-in failed.") : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">AIESEC XP</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Sign in with your AIESEC account to see your progress and the leaderboard.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Link
        href={`/api/auth/start?returnTo=${encodeURIComponent(returnTo)}`}
        className="rounded bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white"
        prefetch={false}
      >
        Sign in with AIESEC
      </Link>
    </main>
  );
}

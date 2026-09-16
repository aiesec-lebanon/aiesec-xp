export const dynamic = "force-dynamic";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">No access</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        AIESEC XP is for members of AIESEC in Lebanon. Your AIESEC account signed in, but it does
        not hold an active position in one of the operating offices.
      </p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        If you believe this is wrong, ask your LCP or the MCVP IM to check that your position is
        recorded in EXPA.
      </p>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="text-sm underline">
          Sign out
        </button>
      </form>
    </main>
  );
}

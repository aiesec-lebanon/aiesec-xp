// Validates the environment once, at startup.
//
// A missing SESSION_SECRET previously surfaced as a 500 at the very end of a
// successful sign-in: the token exchange, the identity call and the member
// upsert had all worked, and the failure looked like an auth problem when it
// was a configuration one. Failing here names the variable instead.

export async function register(): Promise<void> {
  // Only the Node runtime has the full environment; the edge runtime is
  // evaluated separately and holds none of these.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEnv } = await import("@/lib/env");

  try {
    assertEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Thrown in production so a misconfigured deployment stops rather than
    // serving broken sign-ins; logged in development so the dev server still
    // starts and the message is visible in the terminal.
    if (process.env.NODE_ENV === "production") throw error;
    console.error(`\n${message}\n`);
  }
}

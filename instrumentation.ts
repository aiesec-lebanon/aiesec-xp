export async function register(): Promise<void> {
  // The edge runtime is evaluated separately and holds none of these variables.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertEnv } = await import("@/lib/env");

  try {
    assertEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Only logged in development so the dev server still starts.
    if (process.env.NODE_ENV === "production") throw error;
    console.error(`\n${message}\n`);
  }
}

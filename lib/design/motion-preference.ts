import "server-only";

import { cookies } from "next/headers";

// OS prefers-reduced-motion is deliberately ignored; the footer switch is the control.
// A cookie, not localStorage, so the root layout renders the right state server-side.

export const MOTION_COOKIE = "xp_reduce_motion";

export function motionCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function readReduceMotion(): Promise<boolean> {
  return (await cookies()).get(MOTION_COOKIE)?.value === "1";
}

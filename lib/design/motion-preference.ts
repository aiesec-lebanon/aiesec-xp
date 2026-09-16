import "server-only";

import { cookies } from "next/headers";

// Motion is on for everyone by default. The OS `prefers-reduced-motion` setting
// is deliberately not consulted: a system default set years ago for a different
// reason should not quietly mute a product whose whole point is that it moves.
// The member decides instead, with the switch in the footer (D-46), and WCAG
// 2.2.2 is satisfied by that control rather than by the OS.
//
// The preference is a cookie rather than localStorage so the root layout can
// render the right state server-side: reading it after hydration would show a
// burst of the motion the member asked not to see.

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

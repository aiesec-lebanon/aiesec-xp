"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { MOTION_COOKIE, motionCookieOptions } from "./motion-preference";

// A display preference with nothing behind it: it reads and writes no member
// data, so unlike the admin actions it needs no live GIS re-verification, and it
// is deliberately usable before sign-in.
export async function setReduceMotion(reduce: boolean): Promise<void> {
  (await cookies()).set(MOTION_COOKIE, reduce ? "1" : "0", motionCookieOptions());
  revalidatePath("/", "layout");
}

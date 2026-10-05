"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { MOTION_COOKIE, motionCookieOptions } from "./motion-preference";

// Touches no member data, so it is deliberately usable before sign-in.
export async function setReduceMotion(reduce: boolean): Promise<void> {
  (await cookies()).set(MOTION_COOKIE, reduce ? "1" : "0", motionCookieOptions());
  revalidatePath("/", "layout");
}

import "server-only";

import { createHmac } from "node:crypto";

import { sessionSecret } from "@/lib/env";

export type RefPurpose = "refused-sign-in" | "log" | "ip" | "erased";

/**
 * A keyed, one-way reference: the same input gives the same reference, so
 * repeated events can be told apart, but nobody without the secret can turn
 * one back into a GIS id or an address. Each purpose gets its own key.
 */
export function keyedRef(purpose: RefPurpose, value: string): string {
  const key = createHmac("sha256", sessionSecret()).update(`xp-ref:${purpose}`).digest();
  return createHmac("sha256", key).update(value).digest("base64url").slice(0, 22);
}

export function ipRef(ip: string | null): string | null {
  return ip ? keyedRef("ip", ip) : null;
}

/** GIS sends the statistical opt-out as a string; anything truthy counts. */
export function isOptedOut(value: string | null | undefined): boolean {
  return ["true", "1", "yes", "t", "y"].includes((value ?? "").trim().toLowerCase());
}

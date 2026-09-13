import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { sessionSecret } from "@/lib/env";

// Our own session, not AIESEC's. The user's OAuth token is used once, for the
// currentPerson call at login, and then discarded: it is never stored, never
// placed in a cookie, and never used for sync (Architecture.md 4.1). This is the
// deliberate departure from auth-template, which keeps and refreshes it.
//
// HMAC-signed rather than encrypted: the payload is a person id and a role,
// both of which the user already knows. Integrity is what matters, so a signed
// cookie is enough and avoids a JWT dependency.

export const SESSION_COOKIE = "xp_session";

const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type SessionPayload = {
  /** GIS person id. */
  sub: string;
  /** Issued at, epoch seconds. */
  iat: number;
  /** Expires at, epoch seconds. */
  exp: number;
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", sessionSecret()).update(body).digest("base64url");
}

export function issueSession(personId: bigint | string): { value: string; expiresAt: Date } {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: String(personId),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const body = b64url(JSON.stringify(payload));
  return {
    value: `${body}.${sign(body)}`,
    expiresAt: new Date(payload.exp * 1000),
  };
}

export function readSession(cookieValue: string | undefined): SessionPayload | null {
  if (!cookieValue) return null;

  const separator = cookieValue.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = cookieValue.slice(0, separator);
  const presented = Buffer.from(cookieValue.slice(separator + 1), "base64url");
  const expected = Buffer.from(sign(body), "base64url");

  // Equal length is checked first: timingSafeEqual throws on a mismatch, and
  // that throw would itself be a signal.
  if (presented.length !== expected.length) return null;
  if (!timingSafeEqual(presented, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }

  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp * 1000 <= Date.now()) return null;

  return payload;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict would drop the cookie on the cross-site navigation back from
    // AIESEC auth, leaving the user looking at a logged-out page after a
    // successful login.
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

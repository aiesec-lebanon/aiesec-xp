import "server-only";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { authEnv } from "@/lib/env";
import { randomToken } from "@/lib/auth/session";

// Authorization Code against AIESEC auth, for identity only.
//
// `state` is unconditional. auth-template omits it, which leaves the callback
// willing to accept any code an attacker can deliver -- login CSRF. PKCE is not
// used: this is a confidential client so it adds little, AIESEC's handling of a
// challenge is unverified, and with no staging environment (D-37) a half-honoured
// challenge would break every login with no way to test the fix first.

const STATE_COOKIE = "xp_oauth_state";
const RETURN_TO_COOKIE = "xp_oauth_return_to";
const HANDSHAKE_TTL_SECONDS = 10 * 60;

function handshakeCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: HANDSHAKE_TTL_SECONDS,
  };
}

export async function beginHandshake(returnTo: string): Promise<string> {
  const state = randomToken(32);
  const store = await cookies();
  store.set(STATE_COOKIE, state, handshakeCookieOptions());
  store.set(RETURN_TO_COOKIE, safeReturnTo(returnTo), handshakeCookieOptions());
  return state;
}

export type HandshakeResult =
  | { ok: true; returnTo: string }
  | { ok: false; reason: "missing_state" | "state_mismatch" };

export async function completeHandshake(returnedState: string | null): Promise<HandshakeResult> {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value ?? null;
  const returnTo = store.get(RETURN_TO_COOKIE)?.value ?? "/";

  // Cleared whatever the outcome: a handshake is single-use, and a surviving
  // state could be replayed against an attacker-supplied code.
  for (const name of [STATE_COOKIE, RETURN_TO_COOKIE]) {
    store.set(name, "", { ...handshakeCookieOptions(), maxAge: 0 });
  }

  if (!expected || !returnedState) return { ok: false, reason: "missing_state" };

  const a = Buffer.from(expected);
  const b = Buffer.from(returnedState);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "state_mismatch" };
  }

  return { ok: true, returnTo: safeReturnTo(returnTo) };
}

// `//evil.example` is protocol-relative: browsers treat it as absolute, which is
// the usual open-redirect bypass.
export function safeReturnTo(candidate: string | null | undefined): string {
  if (!candidate) return "/";
  if (!candidate.startsWith("/")) return "/";
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return "/";
  if (candidate.startsWith("/api/auth")) return "/";
  return candidate;
}

export function authorizeUrl(state: string): string {
  const { AIESEC_AUTH_URL, AIESEC_CLIENT_ID, AIESEC_REDIRECT_URI } = authEnv();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: AIESEC_CLIENT_ID,
    redirect_uri: AIESEC_REDIRECT_URI,
    state,
  });
  return `${AIESEC_AUTH_URL.replace(/\/$/, "")}/authorize?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  created_at?: number;
};

const TOKEN_TIMEOUT_MS = 10_000;

/**
 * Exchanges the authorization code for an access token. The token is returned
 * to the caller, used once for the identity call, and then goes out of scope.
 * Nothing in this module persists it.
 */
export async function exchangeCode(code: string): Promise<string> {
  const { AIESEC_AUTH_URL, AIESEC_CLIENT_ID, AIESEC_CLIENT_SECRET, AIESEC_REDIRECT_URI } =
    authEnv();

  const response = await fetch(`${AIESEC_AUTH_URL.replace(/\/$/, "")}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: AIESEC_CLIENT_ID,
      client_secret: AIESEC_CLIENT_SECRET,
      redirect_uri: AIESEC_REDIRECT_URI,
    }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`AIESEC token endpoint responded ${response.status}`);
  }

  const body = (await response.json()) as TokenResponse;
  if (!body.access_token) {
    throw new Error("AIESEC token endpoint returned no access_token");
  }

  return body.access_token;
}

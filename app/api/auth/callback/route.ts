import { NextResponse, type NextRequest } from "next/server";

import { completeHandshake, exchangeCode } from "@/lib/auth/oauth";
import { fetchIdentity } from "@/lib/auth/identity";
import { recordLogin } from "@/lib/auth/login";
import { issueSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

function failure(request: NextRequest, reason: string): NextResponse {
  logger.warn("Sign-in failed", { reason });
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  if (params.get("error")) {
    return failure(request, "denied_at_aiesec");
  }

  const code = params.get("code");
  if (!code) return failure(request, "missing_code");

  // Validated before the code is spent: without it the callback would accept any
  // code an attacker could deliver, and a code cannot be retried once used.
  const handshake = await completeHandshake(params.get("state"));
  if (!handshake.ok) return failure(request, handshake.reason);

  let result;
  try {
    // The user's token lives for exactly these two lines. It is never written to
    // a cookie, the database or a log (Architecture.md 4.1).
    const accessToken = await exchangeCode(code);
    const identity = await fetchIdentity(accessToken);
    result = await recordLogin(identity);
  } catch (error) {
    logger.error("Sign-in could not be completed", { error });
    return failure(request, "gis_unavailable");
  }

  if (result.role === "DENIED") {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  // Issuing the session can only fail on configuration, and it is the last step
  // of an otherwise successful sign-in. Left unguarded it surfaces as a 500 on
  // the callback, which reads as an auth fault rather than a missing variable.
  try {
    const session = issueSession(result.memberId);
    const response = NextResponse.redirect(new URL(handshake.returnTo, request.url));
    response.cookies.set(SESSION_COOKIE, session.value, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    logger.error("Signed in, but the session could not be issued", { error });
    return failure(request, "session_unavailable");
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { contentSecurityPolicy, generateNonce, NONCE_HEADER } from "@/lib/security/csp";

// The session check is an optimistic one only: it verifies the cookie's
// signature and expiry, and sends anyone without one to the sign-in page. It
// deliberately makes no database or GIS call and decides no role -- Next's own
// guidance is that proxy is not a session or authorization layer, and
// Architecture.md 4.4 requires every route and action to authorize for itself
// regardless.
//
// The CSP is applied here because a nonce has to be minted per request. Next
// reads it back off the request's Content-Security-Policy header and stamps it
// onto the framework and page scripts itself.

// /lab is the development-only visual stack surface. It is listed here only in
// development, and app/lab/page.tsx returns notFound() in production regardless,
// so neither guard alone can expose it.
const PUBLIC_PATHS =
  process.env.NODE_ENV === "development"
    ? ["/login", "/unauthorized", "/api/auth", "/lab"]
    : ["/login", "/unauthorized", "/api/auth"];

function withSecurityHeaders(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return withSecurityHeaders(request);
  }

  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return withSecurityHeaders(request);

  const target = new URL("/login", request.url);
  target.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(target);
}

export const config = {
  // draco, hdri, fonts and models are vendor CC0 art, typefaces and decoder
  // binaries with no member data in them; running the session check per asset
  // request would only trade a 200 for a 302 on an expired cookie mid-scene.
  // These are exactly the four directories scripts/assets writes into.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|draco/|hdri/|fonts/|models/|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};

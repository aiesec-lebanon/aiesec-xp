import { NextResponse, type NextRequest } from "next/server";

import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { contentSecurityPolicy, generateNonce, NONCE_HEADER } from "@/lib/security/csp";

// Optimistic check only (signature and expiry); every route and action still authorizes itself.
// /api/cron carries CRON_SECRET instead of a session and checks it in the route.
const PUBLIC_PATHS = ["/login", "/unauthorized", "/api/auth", "/api/cron"];

// Next reads the nonce back off the request's CSP header and stamps it onto its scripts.
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
  // Static 3D assets skip the session check so an expired cookie can't redirect them mid-scene.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|draco/|hdri/|models/|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};

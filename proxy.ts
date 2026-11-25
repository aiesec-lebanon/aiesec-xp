import { NextResponse, type NextRequest } from "next/server";

import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { contentSecurityPolicy, generateNonce, NONCE_HEADER } from "@/lib/security/csp";

const PUBLIC_PATHS =
  process.env.NODE_ENV === "development"
    ? ["/login", "/unauthorized", "/api/auth", "/api/cron", "/api/models", "/tv", "/privacy", "/lab"]
    : ["/login", "/unauthorized", "/api/auth", "/api/cron", "/api/models", "/tv", "/privacy"];

function withSecurityHeaders(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|draco/|hdri/|fonts/|models/|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";

import { readSession, SESSION_COOKIE } from "@/lib/auth/session";

// An optimistic check only: it verifies the session cookie's signature and
// expiry, and sends anyone without one to the sign-in page. It deliberately
// makes no database or GIS call and decides no role -- Next's own guidance is
// that proxy is not a session or authorization layer, and Architecture.md 4.4
// requires every route and action to authorize for itself regardless.

const PUBLIC_PATHS = ["/login", "/unauthorized", "/api/auth"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const target = new URL("/login", request.url);
  target.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};

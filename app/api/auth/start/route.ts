import { NextResponse, type NextRequest } from "next/server";

import { authorizeUrl, beginHandshake } from "@/lib/auth/oauth";

// 302, not 307: some user agents handle a cross-origin 307 inconsistently.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  const handshake = beginHandshake(returnTo ?? "/");

  const response = NextResponse.redirect(authorizeUrl(handshake.state), { status: 302 });

  // Must be set on the redirect itself, or it can be followed before the cookie lands.
  for (const cookie of handshake.cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  return response;
}

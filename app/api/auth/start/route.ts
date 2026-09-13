import { NextResponse, type NextRequest } from "next/server";

import { authorizeUrl, beginHandshake } from "@/lib/auth/oauth";

// The redirect is issued server-side, so the client id and the state never need
// to reach client JavaScript.
//
// 302 rather than the default 307: some user agents handle a 307 to a different
// origin inconsistently, and there is no request body to preserve here.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  const handshake = beginHandshake(returnTo ?? "/");

  const response = NextResponse.redirect(authorizeUrl(handshake.state), { status: 302 });

  // Set on this response, so the browser stores the state in the same round trip
  // that sends it to AIESEC. Written any other way, the redirect can be followed
  // before the cookie lands and the callback then fails on a valid sign-in.
  for (const cookie of handshake.cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  return response;
}

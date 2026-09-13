import { NextResponse, type NextRequest } from "next/server";

import { authorizeUrl, beginHandshake } from "@/lib/auth/oauth";

// The redirect is issued server-side, so the client id and the state never need
// to reach client JavaScript.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  const state = await beginHandshake(returnTo ?? "/");
  return NextResponse.redirect(authorizeUrl(state));
}

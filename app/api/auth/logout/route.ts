import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

// POST only: a GET would let any page log the user out with an image tag.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

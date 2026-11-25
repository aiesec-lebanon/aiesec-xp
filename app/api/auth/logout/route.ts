import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

// POST only: a GET would let any page log the user out with an image tag.
// Signing out ends every session of the member, so a copied cookie dies too.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    try {
      await db.member.update({
        where: { id: BigInt(session.sub) },
        data: { sessionVersion: { increment: 1 } },
      });
    } catch (error) {
      logger.warn("Sign-out could not end the member's other sessions", { error });
    }
  }

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

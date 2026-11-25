import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { buildMemberExport } from "@/lib/privacy/member-data";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// A member's own copy of their data. Any signed-in member, including one whose
// position has ended while their session lasts, can take it.
export async function GET(): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!checkRateLimit("export", String(user.id)).allowed) {
    return NextResponse.json({ error: "Try again in an hour." }, { status: 429 });
  }

  const bundle = await buildMemberExport(user.id);
  await db.auditLog.create({
    data: { actorId: user.id, action: "EXPORT", targetType: "Member", targetId: String(user.id) },
  });

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="aiesec-xp-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

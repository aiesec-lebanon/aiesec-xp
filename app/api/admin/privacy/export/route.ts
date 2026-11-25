import { NextResponse, type NextRequest } from "next/server";

import { AuthorizationError, requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { buildMemberExport } from "@/lib/privacy/member-data";

export const dynamic = "force-dynamic";

// The copy an admin sends a member who asked for it and can no longer sign in.
export async function GET(request: NextRequest): Promise<NextResponse> {
  let admin;
  try {
    admin = await requireAdminLive();
  } catch (error) {
    const message = error instanceof AuthorizationError ? error.message : "Please sign in again.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const requestId = request.nextUrl.searchParams.get("request") ?? "";
  const privacyRequest = await db.privacyRequest.findUnique({
    where: { id: requestId },
    select: { memberId: true },
  });
  if (!privacyRequest?.memberId) {
    return NextResponse.json({ error: "Link this request to a member first." }, { status: 404 });
  }

  const bundle = await buildMemberExport(privacyRequest.memberId);
  await db.auditLog.create({
    data: { actorId: admin.id, action: "EXPORT", targetType: "PrivacyRequest", targetId: requestId },
  });

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="aiesec-xp-export-${requestId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

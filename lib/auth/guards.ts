import "server-only";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { currentUser, type CurrentUser } from "@/lib/auth/current-user";
import { parseGisDate, resolveAccess } from "@/lib/auth/roles";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { termStart } from "@/lib/term";

// Every route, page and server action calls one of these itself: the proxy only
// makes an optimistic cookie check, and the entity-wide GIS token isolates nothing.

class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireMemberPage(returnTo: string): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (user.role === "DENIED") redirect("/unauthorized");
  return user;
}

export async function requireMember(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user || user.role === "DENIED") {
    throw new AuthorizationError("Please sign in again.");
  }
  return user;
}

async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireMember();
  if (user.role !== "ADMIN") {
    throw new AuthorizationError("Only the MC's admins can do this.");
  }
  return user;
}

// Re-verified against live GIS so a position revoked since the last sync takes
// effect now. GIS being unreachable denies the action.
export async function requireAdminLive(): Promise<CurrentUser> {
  const user = await requireAdmin();

  const [matchers, operating, floor] = await Promise.all([
    db.adminMatcher.findMany(),
    operatingOfficeIds(),
    termStart(),
  ]);

  let livePositions;
  try {
    // No server-side end_date filter: resolveAccess applies the term rule locally,
    // so a null end date can't lock an admin out via GIS filter semantics.
    const result = await gis().MemberPositions({
      filters: { person_ids: [String(user.id)], status: ["active"] },
      pagination: { page: 1, per_page: 100 },
    });
    livePositions = result.memberPositions?.data ?? [];
  } catch (error) {
    logger.error("Admin re-verification could not reach GIS; action refused", {
      actorId: String(user.id),
      error,
    });
    throw new AuthorizationError("We couldn't confirm your position with EXPA. Try again in a moment.");
  }

  const live = resolveAccess({
    positions: livePositions.flatMap((position) =>
      position?.office?.id
        ? [
            {
              officeId: BigInt(position.office.id),
              roleName: position.role?.name ?? null,
              title: position.title ?? null,
              status: position.status ?? null,
              endDate: parseGisDate(position.end_date),
            },
          ]
        : []
    ),
    matchers,
    operatingOfficeIds: operating,
    termStart: floor,
  });

  if (live.role !== "ADMIN") {
    logger.warn("Admin action refused: GIS no longer reports an admin position", {
      actorId: String(user.id),
      storedRole: user.role,
      liveRole: live.role,
    });
    throw new AuthorizationError("Only the MC's admins can do this.");
  }

  return user;
}

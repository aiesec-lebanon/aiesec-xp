import "server-only";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { currentUser, type CurrentUser } from "@/lib/auth/current-user";
import { canActInOffice, parseGisDate, resolveAccess } from "@/lib/auth/roles";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { termStart } from "@/lib/term";

// Every route, page and server action calls one of these for itself. Nothing is
// inherited from the proxy, which only makes an optimistic cookie check, and
// nothing is inherited from GIS, which with an entity-wide token enforces no
// isolation at all (Architecture.md 4.4).

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For pages: sends the visitor somewhere useful rather than throwing. */
export async function requireMemberPage(returnTo: string): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (user.role === "DENIED") redirect("/unauthorized");
  return user;
}

/** For route handlers and server actions: throws, so a caller cannot forget to stop. */
export async function requireMember(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user || user.role === "DENIED") {
    throw new AuthorizationError("Please sign in again.");
  }
  return user;
}

export async function requireLead(): Promise<CurrentUser> {
  const user = await requireMember();
  if (user.role !== "ADMIN" && user.role !== "LEAD") {
    throw new AuthorizationError("Only LC leaders and MC admins can do this.");
  }
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireMember();
  if (user.role !== "ADMIN") {
    throw new AuthorizationError("Only the MC's admins can do this.");
  }
  return user;
}

/**
 * Ownership check for anything scoped to an LC. ADMIN may act anywhere; LEAD
 * only within their own offices; MEMBER nowhere.
 */
export async function requireOfficeAccess(officeId: bigint): Promise<CurrentUser> {
  const user = await requireLead();
  if (!canActInOffice(user, officeId)) {
    logger.warn("Cross-office action refused", {
      actorId: String(user.id),
      role: user.role,
      requestedOfficeId: String(officeId),
    });
    throw new AuthorizationError("You can only make changes for your own LC.");
  }
  return user;
}

/**
 * Admin check re-verified against live GIS rather than stored positions
 * (Architecture.md 11). Reserved for destructive and configuration-changing
 * actions, where a position revoked since the last sync must take effect now
 * rather than at the next sync.
 *
 * Reads the actor's positions through the service token, so it needs no user
 * token. GIS being unreachable denies the action: an admin mutation is exactly
 * the wrong thing to wave through on a cached answer.
 */
export async function requireAdminLive(): Promise<CurrentUser> {
  const user = await requireAdmin();

  const [matchers, operating, floor] = await Promise.all([
    db.adminMatcher.findMany(),
    operatingOfficeIds(),
    termStart(),
  ]);

  let livePositions;
  try {
    // No server-side end_date filter: the term rule is applied locally by
    // resolveAccess below (D-71), where a position with no end date counts as
    // not ended -- so an admin can never be locked out by how GIS happens to
    // treat a null in a filter.
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

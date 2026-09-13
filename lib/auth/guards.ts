import "server-only";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { currentUser, type CurrentUser } from "@/lib/auth/current-user";
import { canActInOffice, resolveAccess } from "@/lib/auth/roles";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";

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
    throw new AuthorizationError("Authentication required");
  }
  return user;
}

export async function requireLead(): Promise<CurrentUser> {
  const user = await requireMember();
  if (user.role !== "ADMIN" && user.role !== "LEAD") {
    throw new AuthorizationError("This action requires a LEAD or ADMIN position");
  }
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireMember();
  if (user.role !== "ADMIN") {
    throw new AuthorizationError("This action requires an ADMIN position");
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
    throw new AuthorizationError("You may only act within your own LC");
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

  const [matchers, operating] = await Promise.all([
    db.adminMatcher.findMany(),
    operatingOfficeIds(),
  ]);

  let livePositions;
  try {
    const result = await gis().MemberPositions({
      personIds: [String(user.id)],
      status: ["active"],
      page: 1,
      perPage: 100,
    });
    livePositions = result.memberPositions?.data ?? [];
  } catch (error) {
    logger.error("Admin re-verification could not reach GIS; action refused", {
      actorId: String(user.id),
      error,
    });
    throw new AuthorizationError("Could not verify your position with GIS. Try again.");
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
            },
          ]
        : []
    ),
    matchers,
    operatingOfficeIds: operating,
  });

  if (live.role !== "ADMIN") {
    logger.warn("Admin action refused: GIS no longer reports an admin position", {
      actorId: String(user.id),
      storedRole: user.role,
      liveRole: live.role,
    });
    throw new AuthorizationError("This action requires an ADMIN position");
  }

  return user;
}

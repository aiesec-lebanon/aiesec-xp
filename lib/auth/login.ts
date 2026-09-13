import "server-only";

import { db } from "@/lib/db";
import type { GisIdentity } from "@/lib/auth/identity";
import { resolveAccess, type PositionInput, type Role } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";

export type LoginResult = {
  memberId: bigint;
  role: Role;
};

function toPositionInputs(identity: GisIdentity): Array<PositionInput & { id: bigint }> {
  return (identity.current_positions ?? []).flatMap((position) => {
    if (!position?.id || !position.office?.id) return [];
    return [
      {
        id: BigInt(position.id),
        officeId: BigInt(position.office.id),
        roleName: position.role?.name ?? null,
        title: position.title ?? null,
        status: position.status ?? null,
      },
    ];
  });
}

/**
 * Records who signed in and what they may do.
 *
 * Positions are replaced rather than merged: a position that has disappeared
 * from GIS must disappear here too, or a terminated officer would keep the
 * access their vanished row still grants (D-23).
 *
 * A DENIED member is still written. They hold no access, but recording the
 * attempt is what lets an admin see that someone tried and why it failed,
 * rather than the sign-in vanishing without trace.
 */
export async function recordLogin(identity: GisIdentity): Promise<LoginResult> {
  const memberId = BigInt(identity.id);
  const positions = toPositionInputs(identity);

  const [matchers, operating] = await Promise.all([
    db.adminMatcher.findMany(),
    operatingOfficeIds(),
  ]);

  const access = resolveAccess({ positions, matchers, operatingOfficeIds: operating });

  const homeOfficeId = identity.current_office?.id ? BigInt(identity.current_office.id) : null;
  const knownOffices = new Set(operating.map(String));

  const profile = {
    fullName: identity.full_name ?? `Person ${memberId}`,
    profilePhotoUrl: identity.profile_photo ?? null,
    // Only set when the office is one we actually hold, since these columns
    // carry a foreign key and GIS will report offices outside the subtree.
    homeOfficeId: homeOfficeId && knownOffices.has(String(homeOfficeId)) ? homeOfficeId : null,
    scoringOfficeId: access.scoringOfficeId,
    lastSyncedAt: new Date(),
  };

  await db.$transaction([
    db.member.upsert({
      where: { id: memberId },
      create: { id: memberId, ...profile },
      update: profile,
    }),
    db.position.deleteMany({ where: { memberId } }),
    db.position.createMany({
      data: positions.map((position) => ({
        id: position.id,
        memberId,
        officeId: position.officeId,
        roleName: position.roleName,
        title: position.title,
        status: position.status ?? "unknown",
      })),
      skipDuplicates: true,
    }),
  ]);

  if (access.role === "DENIED") {
    logger.warn("Sign-in denied: no active position in an operating office", {
      memberId: String(memberId),
      positionCount: positions.length,
      officeIds: positions.map((position) => String(position.officeId)),
    });
  }

  return { memberId, role: access.role };
}

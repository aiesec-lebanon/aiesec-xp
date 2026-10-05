import "server-only";

import { db } from "@/lib/db";
import type { GisIdentity } from "@/lib/auth/identity";
import { parseGisDate, resolveAccess, type PositionInput, type Role } from "@/lib/auth/roles";
import { personName } from "@/lib/design/names";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { termStart } from "@/lib/term";

export type LoginResult = {
  memberId: bigint;
  role: Role;
};

function toPositionInputs(
  identity: GisIdentity
): Array<PositionInput & { id: bigint; startDate: Date | null }> {
  return (identity.current_positions ?? []).flatMap((position) => {
    if (!position?.id || !position.office?.id) return [];
    return [
      {
        id: BigInt(position.id),
        officeId: BigInt(position.office.id),
        roleName: position.role?.name ?? null,
        title: position.title ?? null,
        status: position.status ?? null,
        startDate: parseGisDate(position.start_date),
        endDate: parseGisDate(position.end_date),
      },
    ];
  });
}

// Positions are replaced, not merged, so a position gone from GIS stops granting
// access. DENIED members are still written so admins can see the failed attempt.
export async function recordLogin(identity: GisIdentity): Promise<LoginResult> {
  const memberId = BigInt(identity.id);
  const positions = toPositionInputs(identity);

  const [matchers, operating, floor] = await Promise.all([
    db.adminMatcher.findMany(),
    operatingOfficeIds(),
    termStart(),
  ]);

  const access = resolveAccess({
    positions,
    matchers,
    operatingOfficeIds: operating,
    termStart: floor,
  });

  const homeOfficeId = identity.current_office?.id ? BigInt(identity.current_office.id) : null;
  const knownOffices = new Set(operating.map(String));

  const profile = {
    fullName: personName(identity.full_name ?? `Person ${memberId}`),
    profilePhotoUrl: identity.profile_photo ?? null,
    // FK column, and GIS reports offices outside the subtree we hold.
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
        startDate: position.startDate,
        endDate: position.endDate,
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

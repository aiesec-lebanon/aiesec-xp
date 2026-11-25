import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { GisIdentity } from "@/lib/auth/identity";
import { parseGisDate, resolveAccess, type PositionInput, type Role } from "@/lib/auth/roles";
import { personName } from "@/lib/design/names";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { isErased } from "@/lib/privacy/member-data";
import { isOptedOut, keyedRef } from "@/lib/privacy/refs";
import { termStart } from "@/lib/term";

export type LoginResult = {
  memberId: bigint;
  role: Role;
  /** True until the member has answered the /tv name question. */
  needsTvConsent: boolean;
  sessionVersion: number;
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

/**
 * Records who signed in and what they may do.
 *
 * Positions are replaced rather than merged: a position that has disappeared
 * from GIS must disappear here too, or a terminated officer would keep the
 * access their vanished row still grants (D-23).
 *
 * Someone with no position in scope this term keeps no profile: the refusal is
 * recorded under a keyed reference and a reason, and deleted after 30 days. A
 * member who left this term is still updated, so their term points stay on the
 * boards, but they get no session.
 */
export async function recordLogin(identity: GisIdentity): Promise<LoginResult> {
  const memberId = BigInt(identity.id);
  const positions = toPositionInputs(identity);

  // Erased at their request: XP keeps nothing new about them.
  if (await isErased(memberId)) {
    await db.refusedSignIn.create({
      data: { personRef: keyedRef("refused-sign-in", String(memberId)), reason: "erased" },
    });
    return { memberId, role: "DENIED", needsTvConsent: false, sessionVersion: 0 };
  }

  const [matchers, operating, floor, existing] = await Promise.all([
    db.adminMatcher.findMany(),
    operatingOfficeIds(),
    termStart(),
    db.member.findUnique({
      where: { id: memberId },
      select: { tvNameConsent: true, sessionVersion: true },
    }),
  ]);

  const access = resolveAccess({
    positions,
    matchers,
    operatingOfficeIds: operating,
    termStart: floor,
  });

  if (access.role === "DENIED" && access.scoringOfficeId === null && !existing) {
    await db.refusedSignIn.create({
      data: {
        personRef: keyedRef("refused-sign-in", String(memberId)),
        reason: positions.length === 0 ? "no_positions" : "no_position_in_scope",
      },
    });
    logger.warn("Sign-in refused: no position in scope this term", {
      positionCount: positions.length,
    });
    return { memberId, role: "DENIED", needsTvConsent: false, sessionVersion: 0 };
  }

  const homeOfficeId = identity.current_office?.id ? BigInt(identity.current_office.id) : null;
  const knownOffices = new Set(operating.map(String));

  const profile = {
    fullName: personName(identity.full_name ?? `Person ${memberId}`),
    statisticsOptOut: isOptedOut(identity.meta?.opt_out_of_statistical_data),
    // Only set when the office is one we actually hold, since these columns
    // carry a foreign key and GIS will report offices outside the subtree.
    homeOfficeId: homeOfficeId && knownOffices.has(String(homeOfficeId)) ? homeOfficeId : null,
    scoringOfficeId: access.scoringOfficeId,
    lastSyncedAt: new Date(),
  };

  const denied = access.role === "DENIED";

  const writes: Prisma.PrismaPromise<unknown>[] = [
    db.member.upsert({
      where: { id: memberId },
      create: { id: memberId, ...profile },
      update: profile,
    }),
    ...(denied
      ? [
          db.refusedSignIn.create({
            data: {
              personRef: keyedRef("refused-sign-in", String(memberId)),
              reason: "position_ended",
            },
          }),
        ]
      : [db.loginEvent.create({ data: { memberId } })]),
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
  ];
  await db.$transaction(writes);

  if (denied) {
    logger.warn("Sign-in refused: the member's position has ended", {
      memberRef: keyedRef("log", String(memberId)),
    });
  }

  return {
    memberId,
    role: access.role,
    needsTvConsent: !denied && (existing?.tvNameConsent ?? null) === null,
    sessionVersion: existing?.sessionVersion ?? 0,
  };
}

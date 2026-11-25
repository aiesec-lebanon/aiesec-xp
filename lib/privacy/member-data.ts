import "server-only";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { replay } from "@/lib/scoring/replay";

import { keyedRef } from "./refs";

/** Stands in for an erased member wherever an id column must stay filled. */
export const ERASED_ACTOR_ID = 0n;

/**
 * Everything XP holds about one member, as the member would ask for it. EP
 * ids are left out: they are other people's data, and a member's own trail
 * never shows them either.
 */
export async function buildMemberExport(memberId: bigint): Promise<Record<string, unknown>> {
  const member = await db.member.findUnique({
    where: { id: memberId },
    include: {
      homeOffice: { select: { name: true } },
      scoringOffice: { select: { name: true } },
      positions: {
        select: { roleName: true, title: true, status: true, startDate: true, endDate: true, officeId: true },
      },
      avatar: { select: { character: true, updatedAt: true } },
      loginEvents: { select: { at: true }, orderBy: { at: "desc" } },
      ledgerEntries: {
        select: {
          stage: true,
          points: true,
          share: true,
          countDelta: true,
          occurredAt: true,
          event: { select: { programmeId: true, eventType: true } },
        },
        orderBy: { occurredAt: "desc" },
      },
      rewardGrants: { select: { earnedAt: true, reward: { select: { label: true } } } },
      assignments: {
        select: { fromExpa: true, fromSheet: true, fromAdmin: true, isMain: true, removedAt: true, createdAt: true },
      },
      sheetMappings: { select: { name: true, lc: true, team: true, createdAt: true } },
    },
  });
  if (!member) throw new Error("No such member");

  const [requests, changes] = await Promise.all([
    db.privacyRequest.findMany({
      where: { memberId },
      select: { kind: true, status: true, message: true, receivedAt: true, closedAt: true },
    }),
    db.auditLog.findMany({
      where: { actorId: memberId },
      select: { action: true, targetType: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    member: {
      expaPersonId: String(member.id),
      fullName: member.fullName,
      homeOffice: member.homeOffice?.name ?? null,
      scoringOffice: member.scoringOffice?.name ?? null,
      firstSeenAt: member.firstSeenAt,
      lastReadFromExpaAt: member.lastSyncedAt,
      optedOutOfStatisticsInExpa: member.statisticsOptOut,
      hiddenFromLeaderboards: member.hiddenFromBoards,
      nameOnOfficeScreen: member.tvNameConsent,
      officeScreenAnswerAt: member.tvConsentAt,
    },
    positions: member.positions.map((position) => ({ ...position, officeId: String(position.officeId) })),
    character: member.avatar,
    signIns: member.loginEvents.map((event) => event.at),
    points: member.ledgerEntries.map((entry) => ({
      stage: entry.stage,
      programmeId: entry.event.programmeId,
      points: Number(entry.points),
      share: Number(entry.share),
      count: Number(entry.countDelta),
      occurredAt: entry.occurredAt,
    })),
    rewards: member.rewardGrants.map((grant) => ({ reward: grant.reward.label, earnedAt: grant.earnedAt })),
    epCredits: member.assignments,
    sheetNameMatches: member.sheetMappings,
    privacyRequests: requests,
    adminChanges: changes,
  };
}

/**
 * Removes a member: their record and everything hanging off it (positions,
 * character, sign-ins, credit, points, rewards), and their id and name from
 * the admin change log, which keeps its entries with the person removed.
 * With `tombstone`, the roster and sign-in skip them from now on.
 */
export async function forgetMember(
  memberId: bigint,
  options: { tombstone: boolean; replay?: boolean }
): Promise<void> {
  const member = await db.member.findUnique({ where: { id: memberId }, select: { fullName: true } });
  const id = String(memberId);

  await db.$transaction(async (tx) => {
    await tx.auditLog.updateMany({ where: { actorId: memberId }, data: { actorId: ERASED_ACTOR_ID } });
    await tx.auditLog.updateMany({
      where: { targetType: "Member", targetId: id },
      data: { targetId: "erased" },
    });
    // JSON keeps the events and loses the person. The id is matched as a whole
    // JSON string, so a longer number that merely contains it is left alone.
    const needles = [JSON.stringify(id), JSON.stringify(member?.fullName ?? "").slice(1, -1)].filter(
      (needle) => needle.length > 2
    );
    for (const escaped of needles) {
      await tx.$executeRaw`
        UPDATE "AuditLog"
        SET "beforeJson" = replace("beforeJson"::text, ${escaped}, ${escaped.startsWith('"') ? '"erased"' : "erased"})::jsonb,
            "afterJson"  = replace("afterJson"::text,  ${escaped}, ${escaped.startsWith('"') ? '"erased"' : "erased"})::jsonb
        WHERE "beforeJson"::text LIKE ${"%" + escaped + "%"}
           OR "afterJson"::text  LIKE ${"%" + escaped + "%"}`;
    }
    await tx.epAssignment.updateMany({ where: { createdBy: memberId }, data: { createdBy: ERASED_ACTOR_ID } });
    await tx.epAssignment.updateMany({ where: { removedBy: memberId }, data: { removedBy: ERASED_ACTOR_ID } });
    await tx.sheetManagerMapping.updateMany({
      where: { createdBy: memberId },
      data: { createdBy: ERASED_ACTOR_ID },
    });
    await tx.privacyRequest.updateMany({ where: { memberId }, data: { memberId: null } });
    await tx.refusedSignIn.deleteMany({ where: { personRef: keyedRef("refused-sign-in", id) } });
    await tx.member.deleteMany({ where: { id: memberId } });
    if (options.tombstone) {
      await tx.erasureTombstone.upsert({
        where: { personRef: keyedRef("erased", id) },
        create: { personRef: keyedRef("erased", id) },
        update: {},
      });
    }
  });

  // Another member's share of an EP this member was credited with changes now.
  if (options.replay === false) return;
  try {
    await replay(ERASED_ACTOR_ID);
  } catch (error) {
    logger.error("Scores could not be recalculated after removing a member", { error });
  }
}

export async function isErased(memberId: bigint | string): Promise<boolean> {
  const row = await db.erasureTombstone.findUnique({
    where: { personRef: keyedRef("erased", String(memberId)) },
    select: { personRef: true },
  });
  return row !== null;
}

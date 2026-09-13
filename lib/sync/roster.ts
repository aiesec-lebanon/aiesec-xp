import "server-only";

import { db } from "@/lib/db";
import { chooseScoringOffice, type PositionInput } from "@/lib/auth/roles";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";

// Sync pass 8, the roster.
//
// Without it, Member holds only people who have signed in, which leaves an
// admin mapping sheet labels to a near-empty list and a leaderboard that cannot
// name anyone who has not visited yet. Positions are also what decide access
// (D-31), so refreshing them here is what makes a term handover take effect
// without each officer having to log in first (D-23).

const PAGE_SIZE = 200;
const MAX_PAGES = 20;

export type RosterSyncResult = {
  officesRead: number;
  membersUpserted: number;
  positionsUpserted: number;
};

type GisPosition = {
  id: bigint;
  memberId: bigint;
  officeId: bigint;
  roleName: string | null;
  title: string | null;
  status: string;
  fullName: string;
  profilePhotoUrl: string | null;
};

async function readOffice(officeId: bigint): Promise<GisPosition[]> {
  const collected: GisPosition[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await gis().MemberPositions({
      officeId: Number(officeId),
      status: ["active"],
      page,
      perPage: PAGE_SIZE,
    });

    const body = result.memberPositions;
    for (const position of body?.data ?? []) {
      if (!position?.id || !position.person?.id) continue;
      collected.push({
        id: BigInt(position.id),
        memberId: BigInt(position.person.id),
        officeId: position.office?.id ? BigInt(position.office.id) : officeId,
        roleName: position.role?.name ?? null,
        title: position.title ?? null,
        status: position.status ?? "active",
        fullName: position.person.full_name ?? `Person ${position.person.id}`,
        profilePhotoUrl: position.person.profile_photo ?? null,
      });
    }

    if (page >= (body?.paging?.total_pages ?? 0)) break;
  }

  return collected;
}

export async function syncRoster(): Promise<RosterSyncResult> {
  const officeIds = await operatingOfficeIds();
  const run = await db.syncRun.create({ data: { pass: "roster", status: "RUNNING" } });

  const officeSet = new Set(officeIds.map(String));

  try {
    const collected: GisPosition[] = [];
    for (const officeId of officeIds) {
      collected.push(...(await readOffice(officeId)));
    }

    // office_id is scope-inclusive: querying the MC returns the whole subtree,
    // closed offices included. Keeping those would put members of a closed LC on
    // the leaderboard and offer them as candidates when mapping sheet names,
    // which contradicts D-01 and D-31.
    const positions = collected.filter((position) => officeSet.has(String(position.officeId)));

    // The same position can arrive once per office queried, since each query
    // returns the subtree beneath it.
    const seen = new Set<string>();
    const deduped = positions.filter((position) => {
      const key = String(position.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    positions.length = 0;
    positions.push(...deduped);

    // Group by person: one member may hold several positions, and their scoring
    // office is decided across all of them (D-32).
    const byMember = new Map<string, GisPosition[]>();
    for (const position of positions) {
      const key = String(position.memberId);
      const bucket = byMember.get(key);
      if (bucket) bucket.push(position);
      else byMember.set(key, [position]);
    }

    for (const [key, held] of byMember) {
      const memberId = BigInt(key);
      const inputs: PositionInput[] = held.map((position) => ({
        officeId: position.officeId,
        roleName: position.roleName,
        title: position.title,
        status: position.status,
      }));

      const scoringOfficeId = chooseScoringOffice(inputs);
      const profile = {
        fullName: held[0].fullName,
        profilePhotoUrl: held[0].profilePhotoUrl,
        // Only set when the office is one we hold, since the column carries a
        // foreign key and GIS reports offices outside the subtree.
        scoringOfficeId:
          scoringOfficeId && officeSet.has(String(scoringOfficeId)) ? scoringOfficeId : null,
        lastSyncedAt: new Date(),
      };

      await db.member.upsert({
        where: { id: memberId },
        create: { id: memberId, ...profile },
        update: profile,
      });
    }

    // Anything outside the operating offices is out of scope by definition, and
    // would otherwise linger from a period when an office was still open.
    await db.position.deleteMany({ where: { officeId: { notIn: officeIds } } });

    // Replaced rather than merged: a position that has gone from GIS must go
    // from here, or a terminated officer keeps the access it still grants.
    const memberIds = [...byMember.keys()].map(BigInt);
    await db.position.deleteMany({
      where: { memberId: { in: memberIds }, officeId: { in: officeIds } },
    });
    await db.position.createMany({
      data: positions.map((position) => ({
        id: position.id,
        memberId: position.memberId,
        officeId: position.officeId,
        roleName: position.roleName,
        title: position.title,
        status: position.status,
      })),
      skipDuplicates: true,
    });

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), eventsSeen: positions.length },
    });

    return {
      officesRead: officeIds.length,
      membersUpserted: byMember.size,
      positionsUpserted: positions.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Roster sync failed", { error });
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message },
    });
    throw error;
  }
}

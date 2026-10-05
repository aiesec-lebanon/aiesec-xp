import "server-only";

import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/admin/window";
import { chooseScoringOffice, parseGisDate, type PositionInput } from "@/lib/auth/roles";
import { personName } from "@/lib/design/names";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { termStart } from "@/lib/term";

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
  startDate: Date | null;
  endDate: Date | null;
  fullName: string;
  profilePhotoUrl: string | null;
};

async function readOffice(officeId: bigint, endDateFrom: string): Promise<GisPosition[]> {
  const collected: GisPosition[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await gis().MemberPositions({
      filters: {
        office_id: Number(officeId),
        status: ["active"],
        // EXPA often leaves last term's positions "active", so status alone isn't enough.
        end_date: { from: endDateFrom },
      },
      pagination: { page, per_page: PAGE_SIZE },
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
        startDate: parseGisDate(position.start_date),
        endDate: parseGisDate(position.end_date),
        fullName: personName(position.person.full_name ?? `Person ${position.person.id}`),
        profilePhotoUrl: position.person.profile_photo ?? null,
      });
    }

    if (page >= (body?.paging?.total_pages ?? 0)) break;
  }

  return collected;
}

export async function syncRoster(): Promise<RosterSyncResult> {
  const [officeIds, endDateFrom] = await Promise.all([
    operatingOfficeIds(),
    termStart().then(toDateInputValue),
  ]);
  const run = await db.syncRun.create({ data: { pass: "roster", status: "RUNNING" } });

  const officeSet = new Set(officeIds.map(String));

  try {
    const collected: GisPosition[] = [];
    for (const officeId of officeIds) {
      collected.push(...(await readOffice(officeId, endDateFrom)));
    }

    // office_id is scope-inclusive: the MC query returns the whole subtree, closed offices included.
    const positions = collected.filter((position) => officeSet.has(String(position.officeId)));

    // Subtree queries overlap, so a position can arrive once per office queried.
    const seen = new Set<string>();
    const deduped = positions.filter((position) => {
      const key = String(position.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    positions.length = 0;
    positions.push(...deduped);

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
        endDate: position.endDate,
      }));

      const scoringOfficeId = chooseScoringOffice(inputs);
      const profile = {
        fullName: held[0].fullName,
        profilePhotoUrl: held[0].profilePhotoUrl,
        // FK column, and GIS reports offices outside the subtree.
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

    // An empty read is a GIS failure; replacing the roster with it would revoke everyone's access.
    if (positions.length === 0) {
      throw new Error("GIS returned no active positions for any operating office; roster left unchanged");
    }

    // Full replace so ended terms drop out; one transaction so no request sees it half-rebuilt.
    await db.$transaction([
      db.position.deleteMany({}),
      db.position.createMany({
        data: positions.map((position) => ({
          id: position.id,
          memberId: position.memberId,
          officeId: position.officeId,
          roleName: position.roleName,
          title: position.title,
          status: position.status,
          startDate: position.startDate,
          endDate: position.endDate,
        })),
        skipDuplicates: true,
      }),
    ]);

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

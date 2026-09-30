import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isInTermPosition, primaryRole } from "@/lib/auth/roles";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { termStart } from "@/lib/term";

/**
 * Members who hold a position this term, as a Prisma filter: the database form
 * of `isInTermPosition()` (lib/auth/roles.ts, D-71) -- change them together.
 * "Has any stored position" is not the same thing: a denied sign-in and a
 * departed officer both leave position rows behind.
 */
export async function inTermMemberWhere(): Promise<Prisma.MemberWhereInput> {
  const [operating, floor] = await Promise.all([operatingOfficeIds(), termStart()]);

  return {
    positions: {
      some: {
        status: { equals: "active", mode: "insensitive" },
        officeId: { in: operating },
        OR: [{ endDate: null }, { endDate: { gte: floor } }],
      },
    },
  };
}

/**
 * Every member this term, keyed by id, with the role they share an EP's points
 * under (D-73). A member absent from the map cannot be credited at all (D-71).
 * Narrowed to `memberIds` when given.
 */
export async function inTermRoles(memberIds?: readonly bigint[]): Promise<Map<string, string | null>> {
  const [operating, floor] = await Promise.all([operatingOfficeIds(), termStart()]);
  const operatingSet = new Set(operating.map(String));

  const positions = await db.position.findMany({
    where: memberIds ? { memberId: { in: [...memberIds] } } : {},
    select: { memberId: true, roleName: true, status: true, officeId: true, endDate: true },
  });

  const held = new Map<string, typeof positions>();
  for (const position of positions) {
    if (!isInTermPosition(position, operatingSet, floor)) continue;
    const key = String(position.memberId);
    const bucket = held.get(key);
    if (bucket) bucket.push(position);
    else held.set(key, [position]);
  }

  return new Map([...held].map(([member, inTerm]) => [member, primaryRole(inTerm)]));
}

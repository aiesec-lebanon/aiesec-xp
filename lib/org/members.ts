import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isInTermPosition, primaryRole } from "@/lib/auth/roles";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { termStart } from "@/lib/term";

// Prisma twin of isInTermPosition() in lib/auth/roles.ts; change them together.
// "Has any stored position" isn't enough: denied sign-ins and departed officers leave rows.
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

// A member absent from the map cannot be credited at all.
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

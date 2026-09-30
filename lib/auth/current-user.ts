import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { personName } from "@/lib/design/names";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { resolveAccess, type ResolvedAccess } from "@/lib/auth/roles";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { termStart } from "@/lib/term";

export type CurrentUser = ResolvedAccess & {
  id: bigint;
  fullName: string;
  profilePhotoUrl: string | null;
};

/**
 * Resolves the signed-in member and their access from stored positions.
 *
 * Role is recomputed from position rows on every request rather than carried in
 * the session cookie, so a terminated officer loses access at the next sync
 * rather than at the next login (D-23). Admin mutations go further and
 * re-verify against live GIS (Architecture.md 11) via requireAdminLive.
 *
 * Memoised per request by React cache, so a page and its layout resolving the
 * user do not hit the database twice.
 */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = readSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const memberId = BigInt(session.sub);

  const [member, matchers, operating, floor] = await Promise.all([
    db.member.findUnique({
      where: { id: memberId },
      include: { positions: true },
    }),
    db.adminMatcher.findMany(),
    operatingOfficeIds(),
    termStart(),
  ]);

  if (!member) return null;

  const access = resolveAccess({
    positions: member.positions.map((position) => ({
      officeId: position.officeId,
      roleName: position.roleName,
      title: position.title,
      status: position.status,
      endDate: position.endDate,
    })),
    matchers,
    operatingOfficeIds: operating,
    termStart: floor,
  });

  return {
    ...access,
    id: member.id,
    fullName: personName(member.fullName),
    profilePhotoUrl: member.profilePhotoUrl,
  };
});

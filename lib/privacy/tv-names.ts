import "server-only";

import { db } from "@/lib/db";

import { TV_PLACEHOLDER_NAME } from "./tv-consent";

/**
 * Names as the public /tv board may show them: the member's own only with
 * their consent, otherwise the placeholder. `named` tells the board whether
 * it may also draw the character the member picked.
 */
export async function withTvNames<T extends { memberId: bigint; fullName: string }>(
  entries: readonly T[]
): Promise<Array<T & { named: boolean }>> {
  if (entries.length === 0) return [];
  const consenting = await db.member.findMany({
    where: { id: { in: [...new Set(entries.map((entry) => entry.memberId))] }, tvNameConsent: true },
    select: { id: true },
  });
  const named = new Set(consenting.map((member) => String(member.id)));

  return entries.map((entry) =>
    named.has(String(entry.memberId))
      ? { ...entry, named: true }
      : { ...entry, fullName: TV_PLACEHOLDER_NAME, named: false }
  );
}

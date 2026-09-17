import "server-only";

import { db } from "@/lib/db";

import { CHARACTERS, characterById, characterFor, type CharacterDefinition } from "./character";

export type MemberAvatar = {
  character: CharacterDefinition;
  /** False until the member has picked one for themselves. */
  chosen: boolean;
};

/**
 * The member's character, falling back to the one their name hashes to. The
 * fallback is why no screen is ever empty, and `chosen` is what the first-run
 * picker keys off.
 */
export async function memberAvatar(memberId: bigint, fullName: string): Promise<MemberAvatar> {
  const row = await db.memberAvatar.findUnique({
    where: { memberId },
    select: { character: true },
  });
  const saved = characterById(row?.character);
  return saved
    ? { character: saved, chosen: true }
    : { character: characterFor(fullName), chosen: false };
}

/** The characters of many members at once, for a leaderboard or a roster. */
export async function memberAvatars(
  members: readonly { id: bigint; fullName: string }[],
): Promise<Map<bigint, CharacterDefinition>> {
  if (members.length === 0) return new Map();

  const rows = await db.memberAvatar.findMany({
    where: { memberId: { in: members.map((member) => member.id) } },
    select: { memberId: true, character: true },
  });
  const saved = new Map(rows.map((row) => [row.memberId, characterById(row.character)]));

  return new Map(
    members.map((member) => [
      member.id,
      saved.get(member.id) ?? characterFor(member.fullName) ?? CHARACTERS[0]!,
    ]),
  );
}

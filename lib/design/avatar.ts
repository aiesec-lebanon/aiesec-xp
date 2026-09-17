import "server-only";

import { db } from "@/lib/db";

import { CHARACTER_PARTS, characterFor, type CharacterColours } from "./character";

export type MemberAvatar = { character: string; colours: CharacterColours };

/**
 * The member's saved avatar, falling back to the body their name hashes to so a
 * member who has never opened the lab still has one.
 */
export async function memberAvatar(memberId: bigint, fullName: string): Promise<MemberAvatar> {
  const row = await db.memberAvatar.findUnique({ where: { memberId } });
  if (!row) return { character: characterFor(fullName).id, colours: {} };

  const colours: CharacterColours = {};
  for (const part of CHARACTER_PARTS) {
    const value = row[part];
    if (value) colours[part] = value;
  }
  return { character: row.character, colours };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/auth/guards";
import { db } from "@/lib/db";

import { CHARACTERS } from "./character";

// A member edits only their own avatar, so the id comes from the session and is
// never accepted from the client. The character is checked against the four,
// because it names a .glb that has to exist.
const schema = z.object({
  character: z.enum(CHARACTERS.map((c) => c.id) as [string, ...string[]]),
});

export type SaveCharacterInput = z.input<typeof schema>;
export type SaveCharacterResult = { ok: true } | { ok: false; error: string };

export async function saveCharacter(input: SaveCharacterInput): Promise<SaveCharacterResult> {
  const user = await requireMember();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That character is not valid" };
  }

  const { character } = parsed.data;
  await db.memberAvatar.upsert({
    where: { memberId: user.id },
    create: { memberId: user.id, character },
    update: { character },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * Parked: saving per-part colours (D-52).
 *
 * MemberAvatar still has the nullable colour columns, so restoring this needs no
 * migration -- only this validation back, and the parts written through to the
 * upsert above.
 *
 * const colour = z
 *   .string()
 *   .regex(/^#[0-9a-fA-F]{6}$/, "Expected a #RRGGBB colour")
 *   .transform((value) => value.toUpperCase());
 *
 * // partialRecord, not record: a part the member left alone is absent, and a
 * // part they cleared is null. Both mean "as drawn".
 * colours: z.partialRecord(z.enum(CHARACTER_PARTS), colour.nullable()).default({}),
 *
 * const parts = Object.fromEntries(CHARACTER_PARTS.map((part) => [part, colours[part] ?? null]));
 * ------------------------------------------------------------------------- */

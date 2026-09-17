"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/auth/guards";
import { db } from "@/lib/db";

import { CHARACTER_PARTS, CHARACTERS } from "./character";

// A member edits only their own avatar, so the id comes from the session and is
// never accepted from the client.

const colour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a #RRGGBB colour")
  .transform((value) => value.toUpperCase());

// The colour picker puts every hex within reach, so the swatch lists are not a
// whitelist. The character is: it names a .glb that has to exist.
const schema = z.object({
  character: z.enum(CHARACTERS.map((c) => c.id) as [string, ...string[]]),
  // partialRecord, not record: a part the member left alone is absent, and a
  // part they cleared is null. Both mean "as drawn".
  colours: z.partialRecord(z.enum(CHARACTER_PARTS), colour.nullable()).default({}),
});

export type SaveCharacterInput = z.input<typeof schema>;
export type SaveCharacterResult = { ok: true } | { ok: false; error: string };

export async function saveCharacter(input: SaveCharacterInput): Promise<SaveCharacterResult> {
  const user = await requireMember();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That character is not valid" };
  }

  const { character, colours } = parsed.data;
  // A part with no choice is stored as NULL, which is what "as drawn" means.
  const parts = Object.fromEntries(CHARACTER_PARTS.map((part) => [part, colours[part] ?? null]));

  await db.memberAvatar.upsert({
    where: { memberId: user.id },
    create: { memberId: user.id, character, ...parts },
    update: { character, ...parts },
  });

  revalidatePath("/me");
  revalidatePath("/");
  return { ok: true };
}

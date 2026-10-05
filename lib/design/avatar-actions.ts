"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/auth/guards";
import { db } from "@/lib/db";

import { CHARACTERS } from "./character";

// The member id comes from the session, never the client; the character names a .glb that must exist.
const schema = z.object({
  character: z.enum(CHARACTERS.map((c) => c.id) as [string, ...string[]]),
});

export type SaveCharacterInput = z.input<typeof schema>;
export type SaveCharacterResult = { ok: true } | { ok: false; error: string };

export async function saveCharacter(input: SaveCharacterInput): Promise<SaveCharacterResult> {
  const user = await requireMember();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That character isn't available. Choose another one." };
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

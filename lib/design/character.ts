// The four bodies a member can be. A member picks one the first time they sign
// in; until they do, their name hashes to one so no screen is ever empty.
//
// Recolouring is parked, not deleted (D-52). The vocabulary below is what the
// paused code reads, and `lib/design/avatar-actions.ts`, `character-model.tsx`
// and `app/me/character-lab.tsx` hold the rest of it in comments.

import { modelPath } from "@/lib/three/assets";

export type CharacterDefinition = {
  id: string;
  /** What members call them. */
  name: string;
  /** The garment form, never a colour, matching the object names in the .blend. */
  label: string;
};

export const CHARACTERS: readonly CharacterDefinition[] = [
  { id: "avatar-hoodie-joggers", name: "Milo", label: "Hoodie and joggers" },
  { id: "avatar-tee-shorts", name: "Remi", label: "Tee and shorts" },
  { id: "avatar-hoodie-cargo", name: "Sami", label: "Hoodie and cargos" },
  { id: "avatar-tee-skirt", name: "Juno", label: "Tee and skirt" },
] as const;

function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function characterFor(name: string): CharacterDefinition {
  return CHARACTERS[hash(name) % CHARACTERS.length]!;
}

export function characterById(id: string | null | undefined): CharacterDefinition | undefined {
  return CHARACTERS.find((character) => character.id === id);
}

/** The body the 3D stage loads. */
export function characterModelPath(id: string): string {
  return modelPath(id);
}

/** Full body, rendered from the same .glb by `scripts/assets/avatar-stills.py`. */
export function characterStillPath(id: string): string {
  return `/characters/${id}.png`;
}

/** Head and shoulders, for a profile picture. */
export function characterPortraitPath(id: string): string {
  return `/characters/${id}-portrait.png`;
}

/* ---------------------------------------------------------------------------
 * Parked: per-part recolouring (D-52).
 *
 * The models ship with their authored materials, so there is nothing to tint.
 * Restoring this means re-running `scripts/assets/avatar-parts.py` to split the
 * meshes again, then uncommenting the blocks that reference these.
 *
 * export const CHARACTER_PARTS = ["skin", "hair", "shirt", "trouser", "shoe"] as const;
 *
 * export type CharacterPart = (typeof CHARACTER_PARTS)[number];
 *
 * export type CharacterColours = Partial<Record<CharacterPart, string>>;
 *
 * export const PART_LABELS: Record<CharacterPart, string> = {
 *   skin: "Skin colour",
 *   hair: "Hair colour",
 *   shirt: "Top colour",
 *   trouser: "Trouser colour",
 *   shoe: "Shoe colour",
 * };
 *
 * // Garments can be any colour, so their swatches are a shortcut and the lab
 * // offered a picker too. Skin and hair stayed on a curated set on purpose.
 * export const PART_TAKES_ANY_COLOUR: readonly CharacterPart[] = ["shirt", "trouser", "shoe"];
 *
 * export const PART_SWATCHES: Record<CharacterPart, readonly string[]> = {
 *   skin: ["#F7D9B8", "#E8B98A", "#C88958", "#9C6238", "#6B4226"],
 *   hair: ["#2B2320", "#6B4226", "#B8752E", "#E8C88A", "#D6453D"],
 *   shirt: ["#037EF3", "#00C16E", "#FFC845", "#F85A40", "#FFFFFF"],
 *   trouser: ["#171614", "#4A4842", "#8F8B81", "#0B5CB8", "#F7F3EC"],
 *   shoe: ["#171614", "#FFFFFF", "#F85A40", "#037EF3"],
 * };
 * ------------------------------------------------------------------------- */

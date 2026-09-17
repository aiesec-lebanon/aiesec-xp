// The variant is a hash of the member's name rather than a stored column, so the
// same person keeps the same body on every screen without a migration.
//
// There is deliberately no table of default colours here: those live in the
// .glb as the baseColorFactor the pipeline wrote (D-50), and duplicating them
// would give them two homes that drift apart on the next rebuild.

import { modelPath } from "@/lib/three/assets";

/** The recolourable slots each character's mesh is split into. */
export const CHARACTER_PARTS = ["skin", "hair", "shirt", "trouser", "shoe"] as const;

export type CharacterPart = (typeof CHARACTER_PARTS)[number];

/** A member's choice so far. A part they have not picked keeps the authored colour. */
export type CharacterColours = Partial<Record<CharacterPart, string>>;

export type CharacterDefinition = {
  id: string;
  /** Names the garment form, never a colour -- colour is what members change. */
  label: string;
};

export const CHARACTERS: readonly CharacterDefinition[] = [
  { id: "avatar-hoodie-joggers", label: "Hoodie and joggers" },
  { id: "avatar-tee-shorts", label: "Tee and shorts" },
  { id: "avatar-hoodie-cargo", label: "Hoodie and cargos" },
  { id: "avatar-tee-skirt", label: "Tee and skirt" },
] as const;

export const PART_LABELS: Record<CharacterPart, string> = {
  skin: "Skin colour",
  hair: "Hair colour",
  shirt: "Top colour",
  trouser: "Trouser colour",
  shoe: "Shoe colour",
};

// Garments can be any colour, so their swatches are a shortcut and the lab
// offers a picker too. Skin and hair stay on a curated set on purpose.
export const PART_TAKES_ANY_COLOUR: readonly CharacterPart[] = ["shirt", "trouser", "shoe"];

export const PART_SWATCHES: Record<CharacterPart, readonly string[]> = {
  skin: ["#F7D9B8", "#E8B98A", "#C88958", "#9C6238", "#6B4226"],
  hair: ["#2B2320", "#6B4226", "#B8752E", "#E8C88A", "#D6453D"],
  shirt: ["#037EF3", "#00C16E", "#FFC845", "#F85A40", "#FFFFFF"],
  trouser: ["#171614", "#4A4842", "#8F8B81", "#0B5CB8", "#F7F3EC"],
  shoe: ["#171614", "#FFFFFF", "#F85A40", "#037EF3"],
};

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

/** The rigged body the 3D stage loads. */
export function characterModelPath(id: string): string {
  return modelPath(id);
}

/** The still, rendered from the same .glb by `scripts/assets/avatar-stills.py`. */
export function characterStillPath(id: string): string {
  return `/characters/${id}.png`;
}

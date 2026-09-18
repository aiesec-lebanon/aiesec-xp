// The bodies a member can be: four forms, each in four palettes. A member picks
// one the first time they sign in; until they do, their name hashes to one so no
// screen is ever empty -- across all of them, so an unchosen crowd is varied
// rather than four people repeated.
//
// Recolouring is parked, not deleted (D-52). The vocabulary below is what the
// paused code reads, and `lib/design/avatar-actions.ts`, `character-model.tsx`
// and `app/me/character-lab.tsx` hold the rest of it in comments.

import { modelPath } from "@/lib/three/assets";

export type CharacterForm = {
  id: string;
  /** What members call them. */
  name: string;
  /** The garment form, never a colour, matching the object names in the .blend. */
  label: string;
  /**
   * Which palettes this form has been baked in. Absent means all of them.
   *
   * A palette needs per-part reference colours tuned against that character's
   * own texture (`avatar-variants.py`), so a body only offers the colourings
   * that actually exist as files.
   */
  palettes?: readonly string[];
};

/** The bodies. A form is a shape and a wardrobe, never a colour. */
export const CHARACTER_FORMS: readonly CharacterForm[] = [
  { id: "avatar-hoodie-joggers", name: "Milo", label: "Hoodie and joggers" },
  { id: "avatar-tee-shorts", name: "Remi", label: "Tee and shorts" },
  { id: "avatar-hoodie-cargo", name: "Sami", label: "Hoodie and cargos" },
  { id: "avatar-tee-skirt", name: "Juno", label: "Tee and skirt" },
  { id: "avatar-crop-joggers", name: "Nour", label: "Crop top and joggers", palettes: ["p1"] },
  { id: "avatar-crop-jeans", name: "Lina", label: "Crop top and jeans", palettes: ["p1"] },
] as const;

export type CharacterPalette = {
  id: string;
  label: string;
  /** Two dots for the switcher: the skin, and the top over it. */
  skin: string;
  top: string;
};

/**
 * How a body is coloured, applied identically to all four forms so the choice
 * reads as the same four options whichever body a member picked.
 *
 * `p1` is what the characters were drawn in, and is the id with no suffix --
 * which is what every avatar saved before palettes existed already holds, so
 * nothing needs migrating. The other three are baked by
 * `scripts/assets/avatar-variants.py`; these swatches are its palettes, and the
 * two files have to be changed together.
 */
export const CHARACTER_PALETTES: readonly CharacterPalette[] = [
  { id: "p1", label: "As drawn", skin: "#E8C0A0", top: "#7C98CD" },
  { id: "p2", label: "Slate", skin: "#D9A87C", top: "#4C6B8A" },
  { id: "p3", label: "Clay", skin: "#8D5A3B", top: "#B5533F" },
  { id: "p4", label: "Sand", skin: "#F0C8A8", top: "#E3DCCB" },
] as const;

export type CharacterDefinition = CharacterForm & {
  /** The form this is a colouring of. */
  form: string;
  palette: string;
};

/** The id of a .glb: the form itself for `p1`, and a suffix for the rest. */
export function variantId(form: string, palette: string): string {
  return palette === CHARACTER_PALETTES[0]!.id ? form : `${form}-${palette}`;
}

/** The palettes a form actually ships in, in the order the switcher shows them. */
export function palettesFor(form: CharacterForm): readonly CharacterPalette[] {
  return form.palettes
    ? CHARACTER_PALETTES.filter((palette) => form.palettes!.includes(palette.id))
    : CHARACTER_PALETTES;
}

export const CHARACTERS: readonly CharacterDefinition[] = CHARACTER_FORMS.flatMap((form) =>
  palettesFor(form).map((palette) => ({
    ...form,
    id: variantId(form.id, palette.id),
    form: form.id,
    palette: palette.id,
  })),
);

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

/** Loaded wherever a body stands (D-53). */
export const ANIMATION_LIBRARY = "avatar-animations";

/**
 * Loaded only where a body does more than stand: talking, pointing, dancing.
 * Kept out of the core so the 600kB is not paid on every screen.
 */
export const SOCIAL_LIBRARY = "avatar-animations-social";

export const CLIPS = {
  /**
   * Cycled at random wherever a body is just standing there. `idle-warrior`,
   * `idle-sitting` and `idle-sitting-2` put a body somewhere the set has no
   * prop for -- a fighting stance, a chair that is not there -- which is a
   * deliberate call (D-60), not an oversight.
   */
  idle: [
    "idle-breathing",
    "idle-happy",
    "idle-happy-2",
    "idle-look-around",
    "idle-stretch",
    "idle-neck-stretch",
    "idle-warrior",
    "idle-sitting",
    "idle-sitting-2",
  ],
  /**
   * For a hero shot, where a wandering gaze or a body sitting down reads as
   * distracted rather than present -- the smallest, calmest slice of `idle`.
   */
  idleCalm: ["idle-breathing", "idle-happy", "idle-happy-2", "idle-look-around"],
  /**
   * Nothing has scored yet. Cheerful idles on an empty board read as the
   * product not knowing what state it is in, so this pool leans restless
   * instead. `disappointed` is a beat everywhere else (D-60); looped here it
   * is closer to a sulk than a reaction, which is what an empty board is.
   * Everything here is in the social library, so a surface using this mood
   * has to ask for it.
   */
  idleEmpty: ["idle-bored", "idle-look-around", "idle-stretch", "idle-warrior", "disappointed"],
  /** Played once now and then, between idles. */
  greet: ["wave"],
  /** For a leaderboard, where every body on screen has something to celebrate. */
  celebrate: ["cheer", "cheer-2", "clap", "rally", "victory"],
  /**
   * A body that has properly won, not merely doing well -- rank 1 on the hero,
   * first place on the podium, and any leading LC (D-60). A surface opts a
   * body into this at random alongside `celebrate` via `useMoodFlourish`
   * rather than replacing it outright, so a leader is not dancing constantly.
   */
  dancing: ["dance", "dance-silly", "dance-silly-2"],
  /**
   * In the library but unplayed. The picker used to walk a character off the
   * frame while the next walked in; choosing a character is not a journey, and
   * a swap caught mid-stride left the body stranded at the edge of the canvas.
   */
  walk: "walk",
  walkStart: "walk-start",
  walkStop: "walk-stop",
  turnLeft: "turn-left",
  turnRight: "turn-right",
  /** Social library: a body reacting to the member, or to the body beside it. */
  social: {
    bored: "idle-bored",
    acknowledge: "acknowledge",
    thumbsUp: "thumbs-up",
    salute: "salute",
    disappointed: "disappointed",
    point: "point",
    /** A runway turn, played once -- not part of any looping pool. */
    catwalk: "idle-catwalk",
    talk: ["talk", "talk-2", "talk-3", "talk-4"],
    agree: "agree",
    glance: "glance",
    secret: "secret",
    dance: "dance",
  },
} as const;

export type CharacterMood = "idle" | "calm" | "celebrate" | "empty" | "dancing";

/** A one-shot clip a surface asks for because something happened. */
export type CharacterBeat =
  | "greet"
  | "acknowledge"
  | "salute"
  | "thumbsUp"
  | "point"
  | "disappointed"
  | "losePoints"
  | "celebrate"
  | "catwalk"
  | "talk"
  | "talkAgain"
  | "agree"
  | "glance";

export function beatClip(beat: CharacterBeat): string {
  switch (beat) {
    case "greet":
      return CLIPS.greet[0];
    case "acknowledge":
      return CLIPS.social.acknowledge;
    case "salute":
      return CLIPS.social.salute;
    case "thumbsUp":
      return CLIPS.social.thumbsUp;
    case "point":
      return CLIPS.social.point;
    case "disappointed":
    case "losePoints":
      return CLIPS.social.disappointed;
    case "celebrate":
      return "victory";
    case "catwalk":
      return CLIPS.social.catwalk;
    case "talk":
      return CLIPS.social.talk[0];
    case "talkAgain":
      return CLIPS.social.talk[1];
    case "agree":
      return CLIPS.social.agree;
    case "glance":
      return CLIPS.social.glance;
  }
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

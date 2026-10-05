import { modelPath } from "@/lib/three/assets";

export type CharacterForm = {
  id: string;
  name: string;
  /** Matches the object names in the .blend. */
  label: string;
  /** Only the palettes baked as files for this form; absent means all. */
  palettes?: readonly string[];
};

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
  skin: string;
  top: string;
};

// p1 has no id suffix, matching avatars saved before palettes existed. The rest
// mirror scripts/assets/avatar-variants.py; change the two together.
const CHARACTER_PALETTES: readonly CharacterPalette[] = [
  { id: "p1", label: "As drawn", skin: "#E8C0A0", top: "#7C98CD" },
  { id: "p2", label: "Slate", skin: "#D9A87C", top: "#4C6B8A" },
  { id: "p3", label: "Clay", skin: "#8D5A3B", top: "#B5533F" },
  { id: "p4", label: "Sand", skin: "#F0C8A8", top: "#E3DCCB" },
] as const;

export type CharacterDefinition = CharacterForm & {
  form: string;
  palette: string;
};

export function variantId(form: string, palette: string): string {
  return palette === CHARACTER_PALETTES[0]!.id ? form : `${form}-${palette}`;
}

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

// Case-folded, so correcting how a name is capitalised never swaps the body a
// member without a saved character is drawn as.
export function characterFor(name: string): CharacterDefinition {
  return CHARACTERS[hash(name.toLowerCase()) % CHARACTERS.length]!;
}

export function characterById(id: string | null | undefined): CharacterDefinition | undefined {
  return CHARACTERS.find((character) => character.id === id);
}

export function characterModelPath(id: string): string {
  return modelPath(id);
}

export function characterStillPath(id: string): string {
  return `/characters/${id}.png`;
}

export const ANIMATION_LIBRARY = "avatar-animations";

// Kept out of the core library so its 600kB isn't paid on every screen.
export const SOCIAL_LIBRARY = "avatar-animations-social";

export const CLIPS = {
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
  idleCalm: ["idle-breathing", "idle-happy", "idle-happy-2", "idle-look-around"],
  // All in the social library, so a surface using this mood has to load it.
  idleEmpty: ["idle-bored", "idle-look-around", "idle-stretch", "idle-warrior", "disappointed"],
  greet: ["wave"],
  celebrate: ["cheer", "cheer-2", "clap", "rally", "victory"],
  dancing: ["dance", "dance-silly", "dance-silly-2"],
  walk: "walk",
  walkStart: "walk-start",
  walkStop: "walk-stop",
  turnLeft: "turn-left",
  turnRight: "turn-right",
  social: {
    bored: "idle-bored",
    acknowledge: "acknowledge",
    thumbsUp: "thumbs-up",
    salute: "salute",
    disappointed: "disappointed",
    point: "point",
    catwalk: "idle-catwalk",
    talk: ["talk", "talk-2", "talk-3", "talk-4"],
    agree: "agree",
    glance: "glance",
    secret: "secret",
    dance: "dance",
  },
} as const;

export type CharacterMood = "idle" | "calm" | "celebrate" | "empty" | "dancing";

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

export function characterPortraitPath(id: string): string {
  return `/characters/${id}-portrait.png`;
}

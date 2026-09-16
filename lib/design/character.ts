// The member's body on the set. Today it is a flat render; D-47 puts a posed
// glTF here instead, and the seam is deliberately narrow -- everything outside
// this module asks for "the character for this member" and gets a source, never
// a file name.
//
// The variant is a hash of the member's name rather than a stored column, so the
// same person keeps the same body on every screen without a migration, and a
// member who has never opened the product still has one. Once the costume
// variants land, the hash becomes an index into those instead.

export const CHARACTERS = [
  "/characters/char-walk-blue.png",
  "/characters/char-curly-front.png",
  "/characters/char-hoodie-front.png",
] as const;

function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function characterFor(name: string): string {
  return CHARACTERS[hash(name) % CHARACTERS.length]!;
}

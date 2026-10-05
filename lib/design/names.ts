// Not after an apostrophe: in a transliterated Arabic name ("Ra'ed", "Sa'ad")
// it marks a sound inside the word, not the start of a new one.
const WORD_PART = /(^|[\s-])(\p{L})([\p{L}'’]*)/gu;

// The rest of a part is lowercased only when it arrived all caps, so "McDonald" survives.
export function personName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(WORD_PART, (_match, lead: string, first: string, rest: string) => {
      const tail = rest !== "" && rest === rest.toUpperCase() ? rest.toLowerCase() : rest;
      return `${lead}${first.toUpperCase()}${tail}`;
    });
}

export function firstName(fullName: string): string {
  return personName(fullName).split(" ")[0] ?? "";
}

export const MC_LABEL = "MC";

export function officeLabel(name: string, { isMc = false }: { isMc?: boolean } = {}): string {
  if (isMc) return MC_LABEL;
  return name.replace(/\s*\(EXP\)/gi, "").replace(/\s+/g, " ").trim();
}

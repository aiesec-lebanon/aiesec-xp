// Matching a sheet's manager label to a member.
//
// The labels are first names as people type them: "Sirine", "Lea N", "Ahmad M",
// "Ahmad K". They are a human convention, disambiguated by an initial, and are
// not identifiers. Nothing here is ever applied automatically on a guess -- it
// only ranks candidates for an admin to confirm, because a wrong match sends
// someone else's reward to the wrong person (O-10).

export type MemberCandidate = {
  id: bigint;
  fullName: string;
};

export type Suggestion = {
  member: MemberCandidate;
  /** 0 to 1. Higher is closer; only used for ordering. */
  confidence: number;
  reason: string;
};

export function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    // Strip accents, so "Léa" and "Lea" compare equal.
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

function nameParts(value: string): string[] {
  return normalise(value).split(" ").filter(Boolean);
}

/**
 * Scores a label against one member.
 *
 * "Lea N" is a first name plus a surname initial, which is how the MC
 * distinguishes two people sharing a first name. A label whose initial
 * contradicts the member's surname scores nothing rather than a little, so the
 * wrong Ahmad never appears above the right one.
 */
export function scoreCandidate(label: string, member: MemberCandidate): Suggestion | null {
  const labelParts = nameParts(label);
  const memberParts = nameParts(member.fullName);
  if (labelParts.length === 0 || memberParts.length === 0) return null;

  const [labelFirst, ...labelRest] = labelParts;
  const [memberFirst, ...memberRest] = memberParts;

  if (normalise(label) === normalise(member.fullName)) {
    return { member, confidence: 1, reason: "Full name matches exactly" };
  }

  if (labelFirst !== memberFirst) {
    // Not a first-name match. Only worth offering if the label appears whole
    // somewhere in the name, e.g. a label that is actually a surname.
    if (memberParts.includes(labelFirst) && labelParts.length === 1) {
      return { member, confidence: 0.4, reason: "Matches a later part of the name" };
    }
    return null;
  }

  if (labelRest.length === 0) {
    return { member, confidence: 0.7, reason: "First name matches" };
  }

  // The label carries a disambiguator: "Lea N", "Ahmad M".
  const qualifier = labelRest.join(" ");
  const surname = memberRest.join(" ");

  if (surname.startsWith(qualifier)) {
    return {
      member,
      confidence: 0.95,
      reason: `First name matches and surname starts with "${qualifier.toUpperCase()}"`,
    };
  }

  // The initial contradicts this member, so they are not a candidate at all.
  return null;
}

export function suggestMembers(
  label: string,
  members: readonly MemberCandidate[],
  limit = 5
): Suggestion[] {
  return members
    .map((member) => scoreCandidate(label, member))
    .filter((suggestion): suggestion is Suggestion => suggestion !== null)
    .sort((a, b) => b.confidence - a.confidence || a.member.fullName.localeCompare(b.member.fullName))
    .slice(0, limit);
}

export type LabelResolution =
  | { status: "MAPPED"; memberId: bigint }
  | { status: "UNMAPPED"; label: string; suggestions: Suggestion[] };

/**
 * Resolves a label through the alias table only. An unmapped label is never
 * guessed into a mapping: it comes back with suggestions for an admin to
 * confirm, and until they do, the rows using it do not score.
 */
export function resolveLabel(
  label: string,
  aliases: ReadonlyMap<string, bigint>,
  members: readonly MemberCandidate[]
): LabelResolution {
  const mapped = aliases.get(normalise(label));
  if (mapped !== undefined) return { status: "MAPPED", memberId: mapped };
  return { status: "UNMAPPED", label, suggestions: suggestMembers(label, members) };
}

export function indexAliases(
  aliases: readonly { label: string; memberId: bigint }[]
): Map<string, bigint> {
  return new Map(aliases.map((alias) => [normalise(alias.label), alias.memberId]));
}

// A shared EP splits its points (D-73), so a member's total can carry a
// fraction. The ledger keeps four places; a screen shows at most two.

export function formatPoints(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** With a sign, for an entry in a trail: "+5.33", "-5". */
export function formatSignedPoints(value: number): string {
  const text = formatPoints(value);
  return value > 0 ? `+${text}` : text;
}

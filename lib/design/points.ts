// A shared EP splits its points, so totals can be fractional; screens show at most two places.
export function formatPoints(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function formatSignedPoints(value: number): string {
  const text = formatPoints(value);
  return value > 0 ? `+${text}` : text;
}

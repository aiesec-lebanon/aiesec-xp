// D-24: AIESEC brand colours, one accent per funnel stage, on a dark competitive
// surface. Every accent below clears WCAG AA 4.5:1 as text on both surface tones
// without tinting, which is why the raw brand values are used unaltered -- see
// Architecture.md 9 non-negotiables. Re-check with scripts/assets/check-contrast
// if a surface tone changes.
//
// three.js and Recharts need real values rather than CSS custom properties, so
// this module is the source and globals.css mirrors it into --color-* tokens.
// tests/design-tokens.test.ts fails if the two drift.

export const SURFACE = {
  base: "#0A0C10",
  raised: "#12151B",
  sunken: "#06080B",
  line: "#232833",
} as const;

export const TEXT = {
  primary: "#F2F5FA",
  secondary: "#C3CBD9",
  muted: "#7B8496",
} as const;

/** One accent per funnel stage, plus the reversal tone breaks are drawn in. */
export const STAGE = {
  APL: "#037EF3",
  APD: "#00C16E",
  RE: "#FFC845",
  BREAK: "#F85A40",
} as const;

export type StageKey = keyof typeof STAGE;

/** Ordered low to high, matching D-05: APL < APD < RE. */
export const STAGE_ORDER = ["APL", "APD", "RE"] as const;

export function stageColour(eventType: string): string {
  if (eventType.endsWith("_BROKEN")) return STAGE.BREAK;
  return STAGE[eventType as StageKey] ?? TEXT.muted;
}

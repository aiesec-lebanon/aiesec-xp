// D-24, resolved as STUDIO: the four AIESEC brand hues at their brand angles,
// standing on warm paper instead of the dark surface the first pass used. The
// stage accents are the raw brand values -- they are the one thing that carries
// the brand, so they are never tinted.
//
// three.js and Recharts need real values rather than CSS custom properties, so
// this module is the source and globals.css mirrors it into --* tokens.
// tests/visual-stack.test.ts fails if the two drift.

export const SURFACE = {
  /** The page. */
  base: "#f6f4f0",
  /** Cards, chips, the dock -- anything lifted off the page. */
  raised: "#ffffff",
  /** Wells inside a card, and the resting state of a toggle. */
  sunken: "#edeae4",
  line: "#e3dfd7",
} as const;

/** The cyclorama a character stands on: wall above, floor below, horizon between. */
export const STAGE_SET = {
  wall: "#fbfaf8",
  floor: "#f1eee8",
  horizon: "#e6e2da",
  /** The oversized number printed behind the body. */
  ghost: "#efece5",
} as const;

export const TEXT = {
  primary: "#171614",
  secondary: "#4a4842",
  muted: "#6a675f",
  faint: "#8f8b81",
} as const;

/** One accent per funnel stage, plus the reversal tone breaks are drawn in. */
export const STAGE = {
  APL: "#037EF3",
  APD: "#00C16E",
  RE: "#FFC845",
  BREAK: "#F85A40",
} as const;

export type StageKey = keyof typeof STAGE;

/**
 * Each accent at three weights: a wash a chip can sit on, a mid tone for a bar,
 * and an ink dark enough to clear AA as text on both the wash and the paper.
 */
export const STAGE_TINT = {
  APL: { wash: "#e2eeff", mid: "#7fb4f7", ink: "#0b5cb8" },
  APD: { wash: "#d9f4e6", mid: "#6fd5a6", ink: "#08704a" },
  RE: { wash: "#fff1d0", mid: "#f7ce6b", ink: "#8a6108" },
  BREAK: { wash: "#ffe4dd", mid: "#f8a08c", ink: "#b23a22" },
} as const;

/** Ordered low to high, matching D-05: APL < APD < RE. */
export const STAGE_ORDER = ["APL", "APD", "RE"] as const;

export function stageColour(eventType: string): string {
  if (eventType.endsWith("_BROKEN")) return STAGE.BREAK;
  return STAGE[eventType as StageKey] ?? TEXT.faint;
}

export function stageTint(eventType: string): (typeof STAGE_TINT)[StageKey] {
  if (eventType.endsWith("_BROKEN")) return STAGE_TINT.BREAK;
  return STAGE_TINT[eventType as StageKey] ?? STAGE_TINT.APL;
}

/**
 * Depth is carried by three shadow steps, not by gradients or borders. e1 rests
 * on the paper, e2 is raised, e3 is lifted clear of it.
 */
export const ELEVATION = {
  e1: "0 1px 2px rgba(23,22,20,.04), 0 4px 12px rgba(23,22,20,.05)",
  e2: "0 2px 4px rgba(23,22,20,.04), 0 12px 28px rgba(23,22,20,.07)",
  e3: "0 4px 8px rgba(23,22,20,.05), 0 24px 56px rgba(23,22,20,.10)",
} as const;

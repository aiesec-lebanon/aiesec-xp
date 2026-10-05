// three.js needs real values, not CSS custom properties, so globals.css mirrors
// this module; tests/visual-stack.test.ts fails if the two drift.

export const SURFACE = {
  base: "#fbfaf8",
  raised: "#ffffff",
  sunken: "#edeae4",
  line: "#e3dfd7",
} as const;

export const TEXT = {
  primary: "#171614",
  secondary: "#4a4842",
  muted: "#6a675f",
  faint: "#8f8b81",
} as const;

export const STAGE = {
  APL: "#037EF3",
  APD: "#00C16E",
  RE: "#FFC845",
  BREAK: "#F85A40",
} as const;

export type StageKey = keyof typeof STAGE;

// ink clears AA as text on both the wash and the paper.
export const STAGE_TINT = {
  APL: { wash: "#e2eeff", mid: "#7fb4f7", ink: "#0b5cb8" },
  APD: { wash: "#d9f4e6", mid: "#6fd5a6", ink: "#08704a" },
  RE: { wash: "#fff1d0", mid: "#f7ce6b", ink: "#8a6108" },
  BREAK: { wash: "#ffe4dd", mid: "#f8a08c", ink: "#b23a22" },
} as const;

export function stageColour(eventType: string): string {
  if (eventType.endsWith("_BROKEN")) return STAGE.BREAK;
  return STAGE[eventType as StageKey] ?? TEXT.faint;
}

import { SURFACE, TEXT } from "@/lib/design/tokens";

// APL < APD < RE is an ordinal scale, not a set of identities: swapping two
// stages would change what the chart means. So chart series take a one-hue ramp
// with monotone lightness -- the reader sees the funnel order in the colour --
// rather than the four independent stage accents D-24 gives the UI. Both are
// AIESEC blue: #258bfd is the brand hue stepped to sit inside the mode's
// lightness band.
//
// Both ramps pass the ordinal checks (monotone L, adjacent dL >= 0.06, single
// hue, light end clear of the surface). Re-run the validator before changing a
// step; do not derive one mode from the other by flipping it.
export const STAGE_RAMP = {
  // light end last: on a dark surface the furthest stage is the brightest.
  dark: { APL: "#0467c7", APD: "#258bfd", RE: "#7bb4fd" },
  // and inverted on a light surface, where dark is the prominent end.
  light: { APL: "#68aafd", APD: "#1682f6", RE: "#0059ab" },
} as const;

export type ChartMode = keyof typeof STAGE_RAMP;

/** Reserved status colour. Never a series slot; always shipped with icon + label. */
export const BREAK_COLOUR = "#f85a40";

export const SERIES_LABEL = {
  APL: "Applications",
  APD: "Approvals",
  RE: "Realizations",
} as const;

export type SeriesKey = keyof typeof SERIES_LABEL;

export const SERIES_ORDER: readonly SeriesKey[] = ["APL", "APD", "RE"];

export const axis = {
  stroke: SURFACE.line,
  tick: { fill: TEXT.muted, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export const grid = {
  stroke: SURFACE.line,
  strokeDasharray: undefined,
  vertical: false,
} as const;

/** 2px line, round caps, and an 8px end marker ringed in the surface colour. */
export const line = {
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  dot: false,
  activeDot: { r: 4, strokeWidth: 2, stroke: SURFACE.raised },
} as const;

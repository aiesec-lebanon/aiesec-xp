import { SURFACE, TEXT } from "@/lib/design/tokens";

// APL < APD < RE is an ordinal scale, not a set of identities: swapping two
// stages would change what the chart means. So chart series take a one-hue ramp
// with monotone lightness -- the reader sees the funnel order in the colour --
// rather than the four independent stage accents D-24 gives the UI. Both are
// AIESEC blue, stepped to sit inside the paper surface's lightness band, with
// the darkest step as the prominent end.
//
// The ramp passes the ordinal checks (monotone L, adjacent dL >= 0.06, single
// hue, light end clear of the surface). Re-run the validator before changing a
// step. STUDIO has one surface, so there is one ramp: the dark counterpart the
// first direction carried is gone rather than kept switchable, because a second
// ramp nothing renders is a second ramp nobody revalidates.
export const STAGE_RAMP = { APL: "#68aafd", APD: "#1682f6", RE: "#0059ab" } as const;

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

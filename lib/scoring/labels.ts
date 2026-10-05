export const PROGRAMME_LABEL: Record<string, string> = { "7": "GV", "8": "GTa", "9": "GTe" };
export const DIRECTION_LABEL: Record<string, string> = { OUTGOING: "Outgoing", INCOMING: "Incoming" };

const THRESHOLD_UNIT: Record<string, [string, string]> = {
  POINTS: ["point", "points"],
  APL_COUNT: ["application", "applications"],
  APD_COUNT: ["approval", "approvals"],
  RE_COUNT: ["realization", "realizations"],
};

/** What a reward's threshold is counted in, worded for `amount` of it. */
export function thresholdUnit(thresholdType: string, amount = 2): string {
  const [one, many] = THRESHOLD_UNIT[thresholdType] ?? ["", ""];
  return amount === 1 ? one : many;
}

import { describe, expect, it } from "vitest";

import { readWeightsForm, sameWeights, validateWeights, type Weights } from "@/lib/scoring/weights";

const CURRENT: Weights = {
  aplPoints: 1,
  apdPoints: 5,
  rePoints: 10,
  productWeights: { "7": 1, "8": 1 },
  directionWeights: { OUTGOING: 1, INCOMING: 1 },
  roleShares: { TM: 40 },
};

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const FULL = {
  "points:APL": "2",
  "points:APD": "6",
  "points:RE": "12",
  "product:7": "1.5",
  "product:8": "1",
  "direction:OUTGOING": "1",
  "direction:INCOMING": "0.5",
  "share:tm": "30",
};

describe("readWeightsForm", () => {
  it("reads every weight, keyed to the configured programmes and directions", () => {
    expect(readWeightsForm(form({ ...FULL, "product:99": "4" }), CURRENT)).toEqual({
      aplPoints: 2,
      apdPoints: 6,
      rePoints: 12,
      productWeights: { "7": 1.5, "8": 1 },
      directionWeights: { OUTGOING: 1, INCOMING: 0.5 },
      roleShares: { TM: 30 },
    });
  });

  it("treats a missing or blank weight as invalid rather than zero", () => {
    const weights = readWeightsForm(form({ ...FULL, "points:RE": " ", "product:8": "" }), CURRENT);
    expect(validateWeights(weights)).toEqual([
      "Realization points need to be 0 or more.",
      "The weight for programme 8 needs to be 0 or more.",
    ]);
  });
});

describe("validateWeights", () => {
  it("accepts zero and rejects negatives", () => {
    expect(validateWeights({ ...CURRENT, aplPoints: 0 })).toEqual([]);
    expect(validateWeights({ ...CURRENT, directionWeights: { OUTGOING: -1 } })).toEqual([
      "The outgoing weight needs to be 0 or more.",
    ]);
  });

  it("keeps the role share rules", () => {
    expect(validateWeights({ ...CURRENT, roleShares: { TM: 120 } })).toHaveLength(1);
  });
});

describe("sameWeights", () => {
  it("sees a change in any weight", () => {
    expect(sameWeights(CURRENT, { ...CURRENT })).toBe(true);
    expect(sameWeights(CURRENT, { ...CURRENT, productWeights: { "7": 1, "8": 2 } })).toBe(false);
    expect(sameWeights(CURRENT, { ...CURRENT, roleShares: { TM: 40, TL: 0 } })).toBe(true);
  });
});

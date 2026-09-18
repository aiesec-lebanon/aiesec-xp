import { describe, expect, it } from "vitest";

import { countsFromPayload, sumProducts } from "@/lib/analytics/funnel-tags";

// Fixture shaped like the AIESEC Analytics API's own response (aies.ec/developer-guides,
// "Using the AIESEC Analytics API"): one o_<stage>_<programme> key per outgoing
// funnel stage and product, each carrying a doc_count.

const PAYLOAD = {
  o_applied_7: { doc_count: 12, applicants: { value: 10 } },
  o_approved_7: { doc_count: 4, applicants: { value: 4 } },
  o_realized_7: { doc_count: 2, applicants: { value: 2 } },
  o_remote_realized_7: { doc_count: 1, applicants: { value: 1 } },
  o_applied_8: { doc_count: 5, applicants: { value: 5 } },
  o_approved_8: { doc_count: 0, applicants: { value: 0 } },
  // Product 9 has no keys at all in this window, as the live API omits stages
  // with zero volume rather than sending a zeroed entry.
} as Record<string, unknown>;

describe("countsFromPayload", () => {
  it("reads doc_count per product and stage", () => {
    const result = countsFromPayload(PAYLOAD, [7, 8, 9]);

    expect(result[7]).toEqual({ APL: 12, APD: 4, RE: 3 });
    expect(result[8]).toEqual({ APL: 5, APD: 0, RE: 0 });
  });

  it("defaults a missing product entirely to zero rather than throwing", () => {
    const result = countsFromPayload(PAYLOAD, [7, 8, 9]);
    expect(result[9]).toEqual({ APL: 0, APD: 0, RE: 0 });
  });

  it("sums realized and remote_realized into one RE figure (D-29)", () => {
    const result = countsFromPayload(PAYLOAD, [7]);
    expect(result[7].RE).toBe(3);
  });

  it("ignores a malformed entry instead of throwing", () => {
    const result = countsFromPayload({ o_applied_7: null }, [7]);
    expect(result[7]).toEqual({ APL: 0, APD: 0, RE: 0 });
  });
});

describe("sumProducts", () => {
  it("collapses every product into one APL/APD/RE figure", () => {
    const result = countsFromPayload(PAYLOAD, [7, 8, 9]);
    expect(sumProducts(result)).toEqual({ APL: 17, APD: 4, RE: 3 });
  });

  it("returns zeros for an empty product map", () => {
    expect(sumProducts({})).toEqual({ APL: 0, APD: 0, RE: 0 });
  });
});

import { describe, expect, it } from "vitest";

import type { Assignment } from "@/lib/scoring/attribution";
import {
  evaluateRewards,
  officePoints,
  score,
  totalsByMember,
  type RewardDefinition,
  type ScorableEvent,
  type ScoringConfig,
  type Window,
} from "@/lib/scoring/engine";

const ALICE = 1001n;
const BOB = 1002n;
const EP = 5000n;

const CONFIG: ScoringConfig = {
  version: 1,
  aplPoints: 1,
  apdPoints: 5,
  rePoints: 10,
  reverseApl: true,
  aplReversingStatuses: ["withdrawn", "rejected"],
  productWeights: { "7": 1, "8": 1, "9": 1 },
  directionWeights: { OUTGOING: 1, INCOMING: 1 },
};

const WINDOW: Window = { startsAt: new Date("2026-07-01T00:00:00Z"), endsAt: null };

const IN = new Date("2026-08-01T00:00:00Z");
const ALSO_IN = new Date("2026-08-15T00:00:00Z");
const BEFORE = new Date("2026-06-01T00:00:00Z");

let seq = 0;
function event(over: Partial<ScorableEvent> = {}): ScorableEvent {
  seq += 1;
  return {
    id: `evt-${seq}`,
    applicationId: 900n,
    eventType: "APL",
    occurredAt: IN,
    epPersonId: EP,
    programmeId: 7,
    direction: "OUTGOING",
    applicationStatus: "open",
    ...over,
  };
}

function assignment(over: Partial<Assignment> = {}): Assignment {
  return {
    epPersonId: EP,
    memberId: ALICE,
    effectiveFrom: new Date("2020-01-01T00:00:00Z"),
    effectiveTo: null,
    ...over,
  };
}

function run(
  events: ScorableEvent[],
  assignments: Assignment[] = [assignment()],
  over: Partial<{ config: ScoringConfig; window: Window; rewards: RewardDefinition[] }> = {}
) {
  return score({
    events,
    assignments,
    config: over.config ?? CONFIG,
    window: over.window ?? WINDOW,
    rewards: over.rewards ?? [],
  });
}

describe("purity", () => {
  it("returns the same ledger for the same inputs", () => {
    const events = [event({ eventType: "APD" })];
    expect(run(events).ledger).toEqual(run(events).ledger);
  });

  it("does not mutate its inputs", () => {
    const events = [event()];
    const assignments = [assignment()];
    const snapshot = JSON.stringify({ events, assignments }, (_k, v) =>
      typeof v === "bigint" ? String(v) : v
    );
    run(events, assignments);
    expect(
      JSON.stringify({ events, assignments }, (_k, v) => (typeof v === "bigint" ? String(v) : v))
    ).toBe(snapshot);
  });
});

describe("points", () => {
  it.each([
    ["APL", 1],
    ["APD", 5],
    ["RE", 10],
  ] as const)("scores %s at its configured value", (eventType, points) => {
    expect(run([event({ eventType })]).ledger[0].points).toBe(points);
  });

  it("orders APL below APD below RE (D-05)", () => {
    const [apl, apd, re] = (["APL", "APD", "RE"] as const).map(
      (eventType) => run([event({ eventType })]).ledger[0].points
    );
    expect(apl).toBeLessThan(apd);
    expect(apd).toBeLessThan(re);
  });

  it("multiplies by the product weight", () => {
    const config = { ...CONFIG, productWeights: { "7": 2.5 } };
    expect(run([event({ eventType: "APD" })], [assignment()], { config }).ledger[0].points).toBe(
      12.5
    );
  });

  it("multiplies by the direction weight", () => {
    const config = { ...CONFIG, directionWeights: { OUTGOING: 0.5, INCOMING: 1 } };
    expect(run([event({ eventType: "RE" })], [assignment()], { config }).ledger[0].points).toBe(5);
  });

  it("weights incoming and outgoing equally by default (D-03)", () => {
    const out = run([event({ eventType: "RE", direction: "OUTGOING" })]).ledger[0].points;
    const inc = run([event({ eventType: "RE", direction: "INCOMING" })]).ledger[0].points;
    expect(out).toBe(inc);
  });

  it("rounds to four places rather than leaking float error", () => {
    const config = { ...CONFIG, aplPoints: 0.1, productWeights: { "7": 0.2 } };
    const points = run([event()], [assignment()], { config }).ledger[0].points;
    expect(points).toBe(0.02);
  });

  it("scores an unconfigured programme at zero and reports it (D-30)", () => {
    const result = run([event({ programmeId: 99 })]);
    expect(result.ledger).toHaveLength(0);
    expect(result.anomalies[0].kind).toBe("UNKNOWN_PROGRAMME_WEIGHT");
  });

  it("never invents a weight of 1 for an unknown programme", () => {
    expect(run([event({ programmeId: 99 })]).ledger).toHaveLength(0);
  });
});

describe("display window (D-08)", () => {
  it("ignores an event before the window opens", () => {
    expect(run([event({ occurredAt: BEFORE })]).ledger).toHaveLength(0);
  });

  it("includes an event exactly on the opening boundary", () => {
    expect(run([event({ occurredAt: WINDOW.startsAt })]).ledger).toHaveLength(1);
  });

  it("ignores an event after a closed window", () => {
    const window: Window = { startsAt: WINDOW.startsAt, endsAt: new Date("2026-07-31T00:00:00Z") };
    expect(run([event({ occurredAt: IN })], [assignment()], { window }).ledger).toHaveLength(0);
  });

  it("includes an event exactly on the closing boundary", () => {
    const window: Window = { startsAt: WINDOW.startsAt, endsAt: IN };
    expect(run([event({ occurredAt: IN })], [assignment()], { window }).ledger).toHaveLength(1);
  });

  it("scores an in-window APD even though its APL fell outside (D-08)", () => {
    const result = run([
      event({ eventType: "APL", occurredAt: BEFORE }),
      event({ eventType: "APD", occurredAt: IN }),
    ]);
    expect(result.ledger).toHaveLength(1);
    expect(result.ledger[0].points).toBe(5);
  });
});

describe("breaks (D-10, D-26)", () => {
  it("negates points and the count", () => {
    const result = run([
      event({ eventType: "APD", occurredAt: IN }),
      event({ eventType: "APD_BROKEN", occurredAt: ALSO_IN }),
    ]);
    expect(result.ledger.map((entry) => entry.points)).toEqual([5, -5]);
    expect(result.ledger.map((entry) => entry.countDelta)).toEqual([1, -1]);
  });

  it("nets an approval and its break to zero", () => {
    const result = run([
      event({ eventType: "APD", occurredAt: IN }),
      event({ eventType: "APD_BROKEN", occurredAt: ALSO_IN }),
    ]);
    const totals = totalsByMember(result.ledger, []);
    expect(totals.get(String(ALICE))?.points).toBe(0);
  });

  it("ignores a break whose stage event is outside the window (D-26)", () => {
    const result = run([
      event({ eventType: "APD", occurredAt: BEFORE }),
      event({ eventType: "APD_BROKEN", occurredAt: IN }),
    ]);
    expect(result.ledger).toHaveLength(0);
    expect(result.anomalies[0].kind).toBe("BREAK_WITHOUT_STAGE_EVENT");
  });

  it("never lets a visible score go negative from pre-window work", () => {
    const result = run([
      event({ eventType: "RE", occurredAt: BEFORE }),
      event({ eventType: "RE_BROKEN", occurredAt: IN }),
    ]);
    const total = totalsByMember(result.ledger, []).get(String(ALICE))?.points ?? 0;
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it("reports an orphan break rather than dropping it silently", () => {
    const result = run([event({ eventType: "RE_BROKEN", occurredAt: IN })]);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].kind).toBe("BREAK_WITHOUT_STAGE_EVENT");
  });

  it("matches a break to its own application, not another's", () => {
    const result = run([
      event({ eventType: "APD", applicationId: 1n, occurredAt: IN }),
      event({ eventType: "APD_BROKEN", applicationId: 2n, occurredAt: ALSO_IN }),
    ]);
    expect(result.ledger).toHaveLength(1);
    expect(result.anomalies[0].kind).toBe("BREAK_WITHOUT_STAGE_EVENT");
  });

  it("does not let an APD break cancel an RE", () => {
    const result = run([
      event({ eventType: "RE", occurredAt: IN }),
      event({ eventType: "APD_BROKEN", occurredAt: ALSO_IN }),
    ]);
    expect(totalsByMember(result.ledger, []).get(String(ALICE))?.points).toBe(10);
  });
});

describe("net APL (D-41)", () => {
  it.each(["withdrawn", "rejected"])("does not score a %s application", (status) => {
    expect(run([event({ applicationStatus: status })]).ledger).toHaveLength(0);
  });

  it.each(["open", "approved", "matched", "finished", "completed", "realized", "approval_broken"])(
    "still scores a %s application",
    (status) => {
      expect(run([event({ applicationStatus: status })]).ledger).toHaveLength(1);
    }
  );

  it("matches the status case-insensitively", () => {
    expect(run([event({ applicationStatus: "Rejected" })]).ledger).toHaveLength(0);
  });

  it("follows the configured list rather than a hardcoded one", () => {
    const config = { ...CONFIG, aplReversingStatuses: ["open"] };
    expect(run([event({ applicationStatus: "open" })], [assignment()], { config }).ledger).toHaveLength(
      0
    );
    expect(
      run([event({ applicationStatus: "rejected" })], [assignment()], { config }).ledger
    ).toHaveLength(1);
  });

  it("keeps the APL when reversal is switched off", () => {
    const config = { ...CONFIG, reverseApl: false };
    expect(
      run([event({ applicationStatus: "rejected" })], [assignment()], { config }).ledger
    ).toHaveLength(1);
  });

  it("reverses only APL, never a later stage of the same application", () => {
    const result = run([
      event({ eventType: "APL", applicationStatus: "rejected" }),
      event({ eventType: "APD", applicationStatus: "rejected" }),
    ]);
    expect(result.ledger).toHaveLength(1);
    expect(result.ledger[0].points).toBe(5);
  });
});

describe("attribution", () => {
  it("credits the assigned member", () => {
    expect(run([event()]).ledger[0].memberId).toBe(ALICE);
  });

  it("gives full points to every concurrent assignee (D-06)", () => {
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE }),
      assignment({ memberId: BOB }),
    ]);
    expect(result.ledger).toHaveLength(2);
    expect(result.ledger.every((entry) => entry.points === 10)).toBe(true);
  });

  it("does not split points between assignees", () => {
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE }),
      assignment({ memberId: BOB }),
    ]);
    expect(result.ledger.reduce((sum, entry) => sum + entry.points, 0)).toBe(20);
  });

  it("credits whoever held the assignment when the event happened (D-36)", () => {
    const result = run([event({ occurredAt: ALSO_IN })], [
      assignment({ memberId: ALICE, effectiveFrom: BEFORE, effectiveTo: IN }),
      assignment({ memberId: BOB, effectiveFrom: IN, effectiveTo: null }),
    ]);
    expect(result.ledger).toHaveLength(1);
    expect(result.ledger[0].memberId).toBe(BOB);
  });

  it("does not credit an assignment that had already ended", () => {
    const result = run([event({ occurredAt: ALSO_IN })], [
      assignment({ effectiveFrom: BEFORE, effectiveTo: IN }),
    ]);
    expect(result.ledger).toHaveLength(0);
  });

  it("does not credit an assignment that had not yet begun", () => {
    const result = run([event({ occurredAt: IN })], [assignment({ effectiveFrom: ALSO_IN })]);
    expect(result.ledger).toHaveLength(0);
  });

  it("attributes per EP, so one assignment drives the whole funnel", () => {
    const result = run([
      event({ eventType: "APL" }),
      event({ eventType: "APD" }),
      event({ eventType: "RE" }),
    ]);
    expect(new Set(result.ledger.map((entry) => String(entry.memberId))).size).toBe(1);
    expect(result.ledger).toHaveLength(3);
  });

  it("records an unattributed event instead of dropping it", () => {
    const result = run([event()], []);
    expect(result.ledger).toHaveLength(0);
    expect(result.anomalies[0].kind).toBe("UNATTRIBUTED");
  });

  it("does not credit an assignment for a different EP", () => {
    expect(run([event({ epPersonId: 9999n })]).ledger).toHaveLength(0);
  });

  it("counts a duplicated assignment once", () => {
    const result = run([event()], [assignment(), assignment()]);
    expect(result.ledger).toHaveLength(1);
  });
});

describe("replay", () => {
  const events = [
    event({ eventType: "APL", occurredAt: IN }),
    event({ eventType: "APD", occurredAt: ALSO_IN }),
  ];

  it("produces a different ledger from a changed config, with no state carried over", () => {
    const before = run(events);
    const after = run(events, [assignment()], {
      config: { ...CONFIG, version: 2, apdPoints: 50 },
    });
    expect(before.ledger[1].points).toBe(5);
    expect(after.ledger[1].points).toBe(50);
    expect(after.ledger.every((entry) => entry.configVersion === 2)).toBe(true);
  });

  it("is idempotent: replaying the same inputs changes nothing", () => {
    expect(run(events).ledger).toEqual(run(events).ledger);
  });

  it("rebuilds from events, assignments and config alone", () => {
    const rebuilt = score({
      events,
      assignments: [assignment()],
      config: CONFIG,
      window: WINDOW,
      rewards: [],
    });
    expect(rebuilt.ledger).toEqual(run(events).ledger);
  });

  it("moves attribution when the assignment register changes", () => {
    expect(run(events, [assignment({ memberId: BOB })]).ledger.every((e) => e.memberId === BOB)).toBe(
      true
    );
  });

  it("drops everything when the window moves past the events", () => {
    const window: Window = { startsAt: new Date("2027-01-01T00:00:00Z"), endsAt: null };
    expect(run(events, [assignment()], { window }).ledger).toHaveLength(0);
  });

  it("stamps every entry with the config version that produced it", () => {
    const result = run(events, [assignment()], { config: { ...CONFIG, version: 7 } });
    expect(result.ledger.every((entry) => entry.configVersion === 7)).toBe(true);
  });
});

describe("rewards", () => {
  const reward: RewardDefinition = { id: "r1", thresholdType: "APD_COUNT", threshold: 2 };

  it("grants nothing below the threshold", () => {
    const result = run([event({ eventType: "APD" })], [assignment()], { rewards: [reward] });
    expect(result.grants).toHaveLength(0);
  });

  it("grants once the threshold is reached", () => {
    const result = run(
      [
        event({ eventType: "APD", applicationId: 1n, occurredAt: IN }),
        event({ eventType: "APD", applicationId: 2n, occurredAt: ALSO_IN }),
      ],
      [assignment()],
      { rewards: [reward] }
    );
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].rewardId).toBe("r1");
  });

  it("dates the grant to when the threshold was crossed, not the latest event", () => {
    const later = new Date("2026-09-01T00:00:00Z");
    const result = run(
      [
        event({ eventType: "APD", applicationId: 1n, occurredAt: IN }),
        event({ eventType: "APD", applicationId: 2n, occurredAt: ALSO_IN }),
        event({ eventType: "APD", applicationId: 3n, occurredAt: later }),
      ],
      [assignment()],
      { rewards: [reward] }
    );
    expect(result.grants[0].earnedAt).toEqual(ALSO_IN);
  });

  it("withdraws the grant when a break drops the count back below (D-20)", () => {
    const result = run(
      [
        event({ eventType: "APD", applicationId: 1n, occurredAt: IN }),
        event({ eventType: "APD", applicationId: 2n, occurredAt: IN }),
        event({ eventType: "APD_BROKEN", applicationId: 2n, occurredAt: ALSO_IN }),
      ],
      [assignment()],
      { rewards: [reward] }
    );
    expect(result.grants).toHaveLength(0);
  });

  it("counts points thresholds against points, not events", () => {
    const points: RewardDefinition = { id: "p", thresholdType: "POINTS", threshold: 10 };
    const result = run([event({ eventType: "RE" })], [assignment()], { rewards: [points] });
    expect(result.grants).toHaveLength(1);
  });

  it("evaluates each reward independently", () => {
    const rewards: RewardDefinition[] = [
      { id: "low", thresholdType: "POINTS", threshold: 5 },
      { id: "high", thresholdType: "POINTS", threshold: 500 },
    ];
    const result = run([event({ eventType: "RE" })], [assignment()], { rewards });
    expect(result.grants.map((grant) => grant.rewardId)).toEqual(["low"]);
  });

  it("grants to each member separately", () => {
    const points: RewardDefinition = { id: "p", thresholdType: "POINTS", threshold: 10 };
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE }),
      assignment({ memberId: BOB }),
    ], { rewards: [points] });
    expect(result.grants).toHaveLength(2);
  });

  it("emits no grants when no rewards are configured", () => {
    expect(run([event({ eventType: "RE" })]).grants).toHaveLength(0);
  });
});

describe("totals", () => {
  it("nets counts against breaks", () => {
    const events = [
      event({ eventType: "RE", applicationId: 1n, occurredAt: IN }),
      event({ eventType: "RE", applicationId: 2n, occurredAt: IN }),
      event({ eventType: "RE_BROKEN", applicationId: 2n, occurredAt: ALSO_IN }),
    ];
    const result = run(events);
    const totals = totalsByMember(result.ledger, events).get(String(ALICE));
    expect(totals).toEqual({ points: 10, aplCount: 0, apdCount: 0, reCount: 1 });
  });

  it("keeps each member's totals separate", () => {
    const events = [event({ eventType: "RE" })];
    const result = run(events, [assignment({ memberId: ALICE }), assignment({ memberId: BOB })]);
    const totals = totalsByMember(result.ledger, events);
    expect(totals.get(String(ALICE))?.points).toBe(10);
    expect(totals.get(String(BOB))?.points).toBe(10);
  });

  it("is empty for an empty ledger", () => {
    expect(totalsByMember([], []).size).toBe(0);
  });
});

describe("degenerate input", () => {
  it("handles no events", () => {
    expect(run([])).toEqual({ ledger: [], grants: [], anomalies: [] });
  });

  it("handles events with no assignments", () => {
    const result = run([event(), event()], []);
    expect(result.ledger).toHaveLength(0);
    expect(result.anomalies).toHaveLength(2);
  });

  it("handles rewards with no ledger", () => {
    expect(evaluateRewards([], [], [{ id: "r", thresholdType: "POINTS", threshold: 1 }])).toEqual(
      []
    );
  });

  it("treats a zero threshold as already met", () => {
    const result = run([event()], [assignment()], {
      rewards: [{ id: "z", thresholdType: "POINTS", threshold: 0 }],
    });
    expect(result.grants).toHaveLength(1);
  });
});

describe("officePoints", () => {
  it("applies base, product and direction weight per programme, then sums", () => {
    const points = officePoints(
      { 7: { APL: 10, APD: 4, RE: 1 }, 8: { APL: 2, APD: 0, RE: 0 } },
      { ...CONFIG, productWeights: { "7": 1, "8": 2 } }
    );
    // programme 7: 10*1 + 4*5 + 1*10 = 40; programme 8: 2*1*2 = 4
    expect(points).toBe(44);
  });

  it("scores zero for a programme with no configured weight (D-30)", () => {
    const points = officePoints({ 5: { APL: 100, APD: 100, RE: 100 } }, CONFIG);
    expect(points).toBe(0);
  });

  it("uses the OUTGOING direction weight by default", () => {
    const points = officePoints(
      { 7: { APL: 1, APD: 0, RE: 0 } },
      { ...CONFIG, directionWeights: { OUTGOING: 0.5, INCOMING: 1 } }
    );
    expect(points).toBe(0.5);
  });

  it("returns zero for an empty count map", () => {
    expect(officePoints({}, CONFIG)).toBe(0);
  });
});

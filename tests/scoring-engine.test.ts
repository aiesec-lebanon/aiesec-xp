import { describe, expect, it } from "vitest";

import type { Assignment } from "@/lib/scoring/attribution";
import {
  constantConfig,
  evaluateRewards,
  officePoints,
  score,
  totalsByMember,
  type LedgerEntry,
  type RewardDefinition,
  type ScorableEvent,
  type ConfigAt,
  type ScoringConfig,
  type Window,
} from "@/lib/scoring/engine";

const ALICE = 1001n;
const BOB = 1002n;
const CAROL = 1003n;
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
  roleShares: {},
};

const WINDOW: Window = { startsAt: new Date("2026-07-01T00:00:00Z"), endsAt: null };

const IN = new Date("2026-08-01T00:00:00Z");
const ALSO_IN = new Date("2026-08-15T00:00:00Z");
const LATER_IN = new Date("2026-09-01T00:00:00Z");
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
  return { epPersonId: EP, memberId: ALICE, role: "TM", ...over };
}

function run(
  events: ScorableEvent[],
  assignments: Assignment[] = [assignment()],
  over: Partial<{
    config: ScoringConfig;
    configAt: ConfigAt;
    window: Window;
    rewards: RewardDefinition[];
    mains: Map<string, bigint>;
  }> = {}
) {
  return score({
    events,
    assignments,
    mains: over.mains,
    configAt: over.configAt ?? constantConfig(over.config ?? CONFIG),
    window: over.window ?? WINDOW,
    rewards: over.rewards ?? [],
  });
}

const stages = (ledger: LedgerEntry[]) => ledger.map((entry) => `${entry.stage}:${entry.points}`);
const total = (ledger: LedgerEntry[], member = ALICE) =>
  totalsByMember(ledger).get(String(member))?.points ?? 0;

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
    expect(stages(run([event({ eventType })]).ledger)).toEqual([`${eventType}:${points}`]);
  });

  it("orders APL below APD below RE", () => {
    const [apl, apd, re] = (["APL", "APD", "RE"] as const).map(
      (eventType) => run([event({ eventType })]).ledger[0].points
    );
    expect(apl).toBeLessThan(apd);
    expect(apd).toBeLessThan(re);
  });

  it("multiplies by the product weight", () => {
    const config = { ...CONFIG, productWeights: { "7": 2.5 } };
    expect(run([event({ eventType: "APD" })], [assignment()], { config }).ledger[0].points).toBe(12.5);
  });

  it("multiplies by the direction weight", () => {
    const config = { ...CONFIG, directionWeights: { OUTGOING: 0.5, INCOMING: 1 } };
    expect(run([event({ eventType: "RE" })], [assignment()], { config }).ledger[0].points).toBe(5);
  });

  it("weights incoming and outgoing equally by default", () => {
    const out = run([event({ eventType: "RE", direction: "OUTGOING" })]).ledger[0].points;
    const inc = run([event({ eventType: "RE", direction: "INCOMING" })]).ledger[0].points;
    expect(out).toBe(inc);
  });

  it("rounds to four places rather than leaking float error", () => {
    const config = { ...CONFIG, aplPoints: 0.1, productWeights: { "7": 0.2 } };
    expect(run([event()], [assignment()], { config }).ledger[0].points).toBe(0.02);
  });

  it("scores an unconfigured programme at zero and reports it", () => {
    const result = run([event({ programmeId: 99 })]);
    expect(result.ledger).toHaveLength(0);
    expect(result.anomalies[0].kind).toBe("UNKNOWN_PROGRAMME_WEIGHT");
  });

  it("never invents a weight of 1 for an unknown programme", () => {
    expect(run([event({ programmeId: 99 })]).ledger).toHaveLength(0);
  });
});

describe("each stage scores in the window it happens in", () => {
  it("credits every stage whose own date is inside the window, each on that date", () => {
    const result = run([
      event({ eventType: "APL", occurredAt: IN }),
      event({ eventType: "APD", occurredAt: ALSO_IN }),
      event({ eventType: "RE", occurredAt: LATER_IN }),
    ]);
    expect(stages(result.ledger)).toEqual(["APL:1", "APD:5", "RE:10"]);
    expect(result.ledger.map((entry) => entry.occurredAt)).toEqual([IN, ALSO_IN, LATER_IN]);
  });

  it("does not bring back an application from before the window when the approval lands inside it", () => {
    const result = run([
      event({ eventType: "APL", occurredAt: BEFORE }),
      event({ eventType: "APD", occurredAt: IN, applicationStatus: "approved" }),
    ]);
    expect(stages(result.ledger)).toEqual(["APD:5"]);
  });

  it("gives a realization from last term that completes this term nothing", () => {
    // Realized 2 Jul, completed 15 Aug, term from 1 Aug.
    const window: Window = { startsAt: new Date("2026-08-01T00:00:00Z"), endsAt: null };
    const result = run(
      [
        event({ eventType: "APL", occurredAt: new Date("2026-04-18T00:00:00Z"), applicationStatus: "completed" }),
        event({ eventType: "APD", occurredAt: new Date("2026-05-01T00:00:00Z"), applicationStatus: "completed" }),
        event({ eventType: "RE", occurredAt: new Date("2026-07-02T00:00:00Z"), applicationStatus: "completed" }),
      ],
      [assignment()],
      { window }
    );
    expect(result.ledger).toHaveLength(0);
  });

  it("points each entry at its own event", () => {
    const apl = event({ eventType: "APL" });
    const apd = event({ eventType: "APD" });
    const ledger = run([apl, apd]).ledger;
    expect(ledger.map((entry) => entry.exchangeEventId)).toEqual([apl.id, apd.id]);
  });

  it("stops at the window's end", () => {
    const window: Window = { startsAt: WINDOW.startsAt, endsAt: new Date("2026-08-10T00:00:00Z") };
    const result = run(
      [event({ eventType: "APL", occurredAt: IN }), event({ eventType: "APD", occurredAt: ALSO_IN })],
      [assignment()],
      { window }
    );
    expect(stages(result.ledger)).toEqual(["APL:1"]);
  });

  it("scores each application of an EP on its own", () => {
    const result = run([
      event({ eventType: "APL", applicationId: 1n }),
      event({ eventType: "APL", applicationId: 2n }),
      event({ eventType: "APD", applicationId: 2n }),
    ]);
    expect(totalsByMember(result.ledger).get(String(ALICE))).toEqual({
      points: 7,
      aplCount: 2,
      apdCount: 1,
      reCount: 0,
    });
  });
});

describe("display window", () => {
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

  it("scores an in-window APD even though its APL fell outside", () => {
    const result = run([
      event({ eventType: "APL", occurredAt: BEFORE }),
      event({ eventType: "APD", occurredAt: IN }),
    ]);
    expect(result.ledger).toHaveLength(1);
    expect(result.ledger[0].points).toBe(5);
  });
});

describe("breaks", () => {
  it("negates points and the count", () => {
    const result = run([
      event({ eventType: "APD", occurredAt: IN }),
      event({ eventType: "APD_BROKEN", occurredAt: ALSO_IN }),
    ]);
    expect(stages(result.ledger)).toEqual(["APD:5", "APD:-5"]);
    expect(result.ledger.map((entry) => entry.countDelta)).toEqual([1, -1]);
  });

  it("nets an approval and its break to zero", () => {
    const result = run([
      event({ eventType: "APD", occurredAt: IN }),
      event({ eventType: "APD_BROKEN", occurredAt: ALSO_IN }),
    ]);
    expect(totalsByMember(result.ledger).get(String(ALICE))).toEqual({
      points: 0,
      aplCount: 0,
      apdCount: 0,
      reCount: 0,
    });
  });

  it("ignores a break whose stage event is outside the window", () => {
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
    expect(total(result.ledger)).toBeGreaterThanOrEqual(0);
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
    expect(stages(result.ledger)).toEqual(["APD:5"]);
    expect(result.anomalies[0].kind).toBe("BREAK_WITHOUT_STAGE_EVENT");
  });

  it("does not let an APD break cancel an RE", () => {
    const result = run([
      event({ eventType: "RE", occurredAt: IN }),
      event({ eventType: "APD_BROKEN", occurredAt: ALSO_IN }),
    ]);
    expect(total(result.ledger)).toBe(10);
  });

  it("ignores a break the stage has since overtaken: approve, break, re-approve", () => {
    const result = run([
      event({ eventType: "APD", occurredAt: LATER_IN }),
      event({ eventType: "APD_BROKEN", occurredAt: ALSO_IN }),
    ]);
    expect(stages(result.ledger)).toEqual(["APD:5"]);
    expect(result.anomalies).toHaveLength(0);
  });

  it("takes back a realization broken inside the window", () => {
    const result = run([
      event({ eventType: "RE", occurredAt: IN }),
      event({ eventType: "RE_BROKEN", occurredAt: ALSO_IN }),
    ]);
    expect(totalsByMember(result.ledger).get(String(ALICE))).toEqual({
      points: 0,
      aplCount: 0,
      apdCount: 0,
      reCount: 0,
    });
  });
});

describe("net APL", () => {
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
    expect(run([event({ applicationStatus: "open" })], [assignment()], { config }).ledger).toHaveLength(0);
    expect(run([event({ applicationStatus: "rejected" })], [assignment()], { config }).ledger).toHaveLength(1);
  });

  it("keeps the APL when reversal is switched off", () => {
    const config = { ...CONFIG, reverseApl: false };
    expect(run([event({ applicationStatus: "rejected" })], [assignment()], { config }).ledger).toHaveLength(1);
  });

  it("reverses only APL, never a later stage of the same application", () => {
    const result = run([
      event({ eventType: "APL", applicationStatus: "rejected" }),
      event({ eventType: "APD", applicationStatus: "rejected" }),
    ]);
    expect(stages(result.ledger)).toEqual(["APD:5"]);
  });
});

describe("attribution", () => {
  it("credits the assigned member", () => {
    expect(run([event()]).ledger[0].memberId).toBe(ALICE);
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

  it("counts a member named by two sources once", () => {
    const result = run([event()], [assignment(), assignment()]);
    expect(result.ledger).toHaveLength(1);
    expect(result.ledger[0].points).toBe(1);
  });

  it("credits whoever holds the EP now, for every event", () => {
    const result = run([event({ occurredAt: IN }), event({ eventType: "APD", occurredAt: LATER_IN })], [
      assignment({ memberId: BOB }),
    ]);
    expect(result.ledger.every((entry) => entry.memberId === BOB)).toBe(true);
  });
});

describe("main manager and role shares", () => {
  const shares = { TM: 40, TL: 30, LCVP: 25, MCP: 10 };
  const config = { ...CONFIG, roleShares: shares };
  const mainIs = (member: bigint) => new Map([[String(EP), member]]);

  it("gives the main manager the full points and everyone else their role's %", () => {
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE, role: "MCP" }),
      assignment({ memberId: BOB, role: "TL" }),
      assignment({ memberId: CAROL, role: "LCVP" }),
    ], { config, mains: mainIs(ALICE) });
    expect(total(result.ledger, ALICE)).toBe(10);
    expect(total(result.ledger, BOB)).toBe(3);
    expect(total(result.ledger, CAROL)).toBe(2.5);
  });

  it("can pay out more than the EP's points", () => {
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE, role: "TM" }),
      assignment({ memberId: BOB, role: "TM" }),
    ], { config, mains: mainIs(ALICE) });
    const paid = result.ledger.reduce((sum, entry) => sum + entry.points, 0);
    expect(paid).toBe(14);
  });

  it("gives two people in the same role the full % each", () => {
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE, role: "MCP" }),
      assignment({ memberId: BOB, role: "TL" }),
      assignment({ memberId: CAROL, role: "TL" }),
    ], { config, mains: mainIs(ALICE) });
    expect(total(result.ledger, BOB)).toBe(3);
    expect(total(result.ledger, CAROL)).toBe(3);
  });

  it("gives everyone their role's % when no main is picked", () => {
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE, role: "TM" }),
      assignment({ memberId: BOB, role: "TL" }),
    ], { config });
    expect(total(result.ledger, ALICE)).toBe(4);
    expect(total(result.ledger, BOB)).toBe(3);
  });

  it("gives a manager alone on an EP everything, with no pick needed", () => {
    const result = run([event({ eventType: "RE" })], [assignment({ role: "LCVP" })], { config });
    expect(total(result.ledger)).toBe(10);
    expect(result.ledger.every((entry) => entry.share === 1 && entry.countDelta === 1)).toBe(true);
  });

  it("promotes nobody when the main is no longer a member, not even a lone manager left", () => {
    const result = run([event({ eventType: "RE" })], [assignment({ memberId: BOB, role: "TL" })], {
      config,
      mains: mainIs(CAROL),
    });
    expect(total(result.ledger, BOB)).toBe(3);
  });

  it("counts the stage as 1 for the main and as the role's % for everyone else", () => {
    const result = run([event({ eventType: "APD" })], [
      assignment({ memberId: ALICE, role: "MCP" }),
      assignment({ memberId: BOB, role: "TL" }),
    ], { config, mains: mainIs(ALICE) });
    expect(totalsByMember(result.ledger).get(String(ALICE))?.apdCount).toBe(1);
    expect(totalsByMember(result.ledger).get(String(BOB))?.apdCount).toBe(0.3);
  });

  it("takes back a break at exactly the share it paid, in points and counts", () => {
    const result = run(
      [event({ eventType: "APD", occurredAt: IN }), event({ eventType: "APD_BROKEN", occurredAt: ALSO_IN })],
      [assignment({ memberId: ALICE, role: "TM" }), assignment({ memberId: BOB, role: "TL" })],
      { config, mains: mainIs(ALICE) }
    );
    for (const member of [ALICE, BOB]) {
      const totals = totalsByMember(result.ledger).get(String(member));
      expect(totals?.points).toBeCloseTo(0, 6);
      expect(totals?.apdCount).toBeCloseTo(0, 6);
    }
  });

  it("gives a role with no % nothing, and writes no entry for it", () => {
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE, role: "TM" }),
      assignment({ memberId: BOB, role: "ESTL" }),
    ], { config, mains: mainIs(ALICE) });
    expect(result.ledger.some((entry) => entry.memberId === BOB)).toBe(false);
  });

  it("records each member's share on the entry", () => {
    const result = run([event()], [
      assignment({ memberId: ALICE, role: "TM" }),
      assignment({ memberId: BOB, role: "TL" }),
    ], { config, mains: mainIs(BOB) });
    const share = new Map(result.ledger.map((entry) => [entry.memberId, entry.share]));
    expect(share.get(ALICE)).toBe(0.4);
    expect(share.get(BOB)).toBe(1);
  });
});

describe("replay", () => {
  const events = [
    event({ eventType: "APL", occurredAt: IN }),
    event({ eventType: "APD", occurredAt: ALSO_IN }),
  ];

  it("produces a different ledger from a changed config, with no state carried over", () => {
    const before = run(events);
    const after = run(events, [assignment()], { config: { ...CONFIG, version: 2, apdPoints: 50 } });
    expect(before.ledger[1].points).toBe(5);
    expect(after.ledger[1].points).toBe(50);
    expect(after.ledger.every((entry) => entry.configVersion === 2)).toBe(true);
  });

  it("is idempotent: replaying the same inputs changes nothing", () => {
    expect(run(events).ledger).toEqual(run(events).ledger);
  });

  it("moves attribution when the assignment register changes", () => {
    expect(run(events, [assignment({ memberId: BOB })]).ledger.every((e) => e.memberId === BOB)).toBe(true);
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

describe("each period keeps its own weights", () => {
  const CHANGE = new Date("2026-08-10T00:00:00Z");
  const OLD = CONFIG;
  const NEW: ScoringConfig = { ...CONFIG, version: 2, aplPoints: 2, apdPoints: 3, roleShares: { TL: 50 } };
  const configAt: ConfigAt = (at) => (at < CHANGE ? OLD : NEW);

  it("scores each stage with the weights in force on its own date", () => {
    const result = run(
      [event({ eventType: "APL", occurredAt: IN }), event({ eventType: "APD", occurredAt: ALSO_IN })],
      [assignment()],
      { configAt }
    );
    expect(stages(result.ledger)).toEqual(["APL:1", "APD:3"]);
    expect(result.ledger.map((entry) => entry.configVersion)).toEqual([1, 2]);
  });

  it("takes back exactly what the stage paid, not what it would pay now", () => {
    const result = run(
      [event({ eventType: "APD", occurredAt: IN }), event({ eventType: "APD_BROKEN", occurredAt: LATER_IN })],
      [assignment()],
      { configAt }
    );
    expect(stages(result.ledger)).toEqual(["APD:5", "APD:-5"]);
    expect(result.ledger.map((entry) => entry.configVersion)).toEqual([1, 1]);
    expect(total(result.ledger)).toBe(0);
  });

  it("shares a stage by the role percentages of its own period", () => {
    const team = [assignment({ memberId: ALICE, role: "TL" }), assignment({ memberId: BOB, role: "TL" })];
    const before = run([event({ eventType: "APD", occurredAt: IN })], team, {
      configAt: (at) => (at < CHANGE ? { ...OLD, roleShares: { TL: 20 } } : NEW),
    });
    const after = run([event({ eventType: "APD", occurredAt: ALSO_IN })], team, { configAt });
    expect(before.ledger.map((entry) => entry.points)).toEqual([1, 1]);
    expect(after.ledger.map((entry) => entry.points)).toEqual([1.5, 1.5]);
  });

  it("reverses an APL by the statuses of the period the APL happened in", () => {
    const result = run([event({ eventType: "APL", occurredAt: IN, applicationStatus: "open" })], [assignment()], {
      configAt: (at) => (at < CHANGE ? OLD : { ...NEW, aplReversingStatuses: ["open"] }),
    });
    expect(stages(result.ledger)).toEqual(["APL:1"]);
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
    const result = run(
      [
        event({ eventType: "APD", applicationId: 1n, occurredAt: IN }),
        event({ eventType: "APD", applicationId: 2n, occurredAt: ALSO_IN }),
        event({ eventType: "APD", applicationId: 3n, occurredAt: LATER_IN }),
      ],
      [assignment()],
      { rewards: [reward] }
    );
    expect(result.grants[0].earnedAt).toEqual(ALSO_IN);
  });

  it("withdraws the grant when a break drops the count back below", () => {
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

  it("grants to each member separately, on their own share", () => {
    const points: RewardDefinition = { id: "p", thresholdType: "POINTS", threshold: 5 };
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE, role: "TM" }),
      assignment({ memberId: BOB, role: "TM" }),
      assignment({ memberId: CAROL, role: "TL" }),
    ], {
      rewards: [points],
      config: { ...CONFIG, roleShares: { TM: 50, TL: 30 } },
      mains: new Map([[String(EP), ALICE]]),
    });
    expect(result.grants.map((grant) => grant.memberId).sort()).toEqual([ALICE, BOB]);
  });

  it("measures a count goal on decimal counts", () => {
    const apds: RewardDefinition = { id: "c", thresholdType: "APD_COUNT", threshold: 0.5 };
    const result = run([event({ eventType: "APD" })], [
      assignment({ memberId: ALICE, role: "TM" }),
      assignment({ memberId: BOB, role: "TL" }),
    ], { rewards: [apds], config: { ...CONFIG, roleShares: { TM: 50, TL: 30 } } });
    expect(result.grants.map((grant) => grant.memberId)).toEqual([ALICE]);
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
    const totals = totalsByMember(run(events).ledger).get(String(ALICE));
    expect(totals).toEqual({ points: 10, aplCount: 0, apdCount: 0, reCount: 1 });
  });

  it("keeps each member's totals separate", () => {
    const result = run([event({ eventType: "RE" })], [
      assignment({ memberId: ALICE }),
      assignment({ memberId: BOB }),
    ], { config: { ...CONFIG, roleShares: { TM: 50 } }, mains: new Map([[String(EP), ALICE]]) });
    const totals = totalsByMember(result.ledger);
    expect(totals.get(String(ALICE))?.points).toBe(10);
    expect(totals.get(String(BOB))?.points).toBe(5);
  });

  it("is empty for an empty ledger", () => {
    expect(totalsByMember([]).size).toBe(0);
  });
});

describe("degenerate input", () => {
  it("handles no events", () => {
    expect(run([])).toEqual({ ledger: [], grants: [], anomalies: [] });
  });

  it("reports every unattributed event", () => {
    const result = run([event({ applicationId: 1n }), event({ applicationId: 2n, eventType: "RE" })], []);
    expect(result.ledger).toHaveLength(0);
    expect(result.anomalies).toHaveLength(2);
    expect(result.anomalies.every((anomaly) => anomaly.kind === "UNATTRIBUTED")).toBe(true);
  });

  it("handles rewards with no ledger", () => {
    expect(evaluateRewards([], [{ id: "r", thresholdType: "POINTS", threshold: 1 }])).toEqual([]);
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

  it("scores zero for a programme with no configured weight", () => {
    expect(officePoints({ 5: { APL: 100, APD: 100, RE: 100 } }, CONFIG)).toBe(0);
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

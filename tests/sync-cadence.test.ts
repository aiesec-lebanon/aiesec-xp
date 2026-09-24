import { describe, expect, it } from "vitest";

import {
  CATCH_UP_AFTER_MS,
  decideRun,
  isHackathonOn,
  isOverdue,
  MIN_GAP_MS,
} from "@/lib/sync/cadence";

// D-66. The GitHub workflows only tick; these rules decide whether a tick has
// work, which is what makes hackathon mode a switch in the admin console.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NOW = new Date("2026-09-25T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const fromNow = (ms: number) => new Date(NOW.getTime() + ms);

describe("isHackathonOn", () => {
  it("is off when no end time is set", () => {
    expect(isHackathonOn(null, NOW)).toBe(false);
  });

  it("is on until its end time", () => {
    expect(isHackathonOn(fromNow(MINUTE), NOW)).toBe(true);
  });

  it("lapses by itself once the end time has passed", () => {
    expect(isHackathonOn(ago(1), NOW)).toBe(false);
  });
});

describe("decideRun", () => {
  const idle = { now: NOW, hackathonUntil: null, lastStartedAt: ago(HOUR) };
  const duringHackathon = { ...idle, hackathonUntil: fromNow(DAY) };

  it("always runs for an admin, even straight after another run", () => {
    expect(decideRun({ ...idle, trigger: "MANUAL", lastStartedAt: ago(10 * 1000) })).toBe("run");
  });

  it("runs the daily schedule", () => {
    expect(decideRun({ ...idle, trigger: "SCHEDULE", lastStartedAt: ago(DAY) })).toBe("run");
  });

  it("drops a scheduled tick that lands right after another start", () => {
    expect(decideRun({ ...idle, trigger: "SCHEDULE", lastStartedAt: ago(MIN_GAP_MS - 1) })).toBe(
      "ran-recently"
    );
    expect(
      decideRun({ ...duringHackathon, trigger: "HACKATHON", lastStartedAt: ago(30 * 1000) })
    ).toBe("ran-recently");
  });

  it("lets a tick through that GitHub delayed towards the next one", () => {
    expect(
      decideRun({ ...duringHackathon, trigger: "HACKATHON", lastStartedAt: ago(3 * MINUTE) })
    ).toBe("run");
  });

  it("runs every tick in hackathon mode", () => {
    expect(
      decideRun({ ...duringHackathon, trigger: "HACKATHON", lastStartedAt: ago(5 * MINUTE) })
    ).toBe("run");
  });

  it("ignores the tick outside hackathon mode", () => {
    expect(decideRun({ ...idle, trigger: "HACKATHON" })).toBe("hackathon-off");
  });

  it("ignores the tick once hackathon mode has lapsed", () => {
    expect(decideRun({ ...idle, trigger: "HACKATHON", hackathonUntil: ago(1) })).toBe(
      "hackathon-off"
    );
  });

  it("catches up a daily run that was never attempted", () => {
    expect(
      decideRun({ ...idle, trigger: "HACKATHON", lastStartedAt: ago(CATCH_UP_AFTER_MS + MINUTE) })
    ).toBe("run");
    expect(decideRun({ ...idle, trigger: "HACKATHON", lastStartedAt: null })).toBe("run");
  });

  it("retries a failing job daily, not on every tick", () => {
    // A daily run that failed an hour ago is still an attempt an hour ago.
    expect(decideRun({ ...idle, trigger: "HACKATHON", lastStartedAt: ago(HOUR) })).toBe(
      "hackathon-off"
    );
  });
});

describe("isOverdue", () => {
  it("flags a job that has never succeeded", () => {
    expect(isOverdue("events", null, NOW)).toBe(true);
    expect(isOverdue("roster", null, NOW)).toBe(true);
  });

  it("gives EP data a day and some slack", () => {
    expect(isOverdue("events", ago(25 * HOUR), NOW)).toBe(false);
    expect(isOverdue("events", ago(27 * HOUR), NOW)).toBe(true);
  });

  it("gives members a month and some slack", () => {
    expect(isOverdue("roster", ago(31 * DAY), NOW)).toBe(false);
    expect(isOverdue("roster", ago(33 * DAY), NOW)).toBe(true);
  });
});

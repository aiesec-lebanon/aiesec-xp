import { describe, expect, it } from "vitest";

import { formatOfficeTime, timeAgo } from "@/lib/design/time-labels";

describe("formatOfficeTime", () => {
  it("reads in Beirut time, which is UTC+3 in summer", () => {
    expect(formatOfficeTime(new Date("2026-09-27T15:00:00.000Z"))).toBe("Sun 27 Sep, 18:00");
  });

  it("follows Beirut back to UTC+2 in winter", () => {
    expect(formatOfficeTime(new Date("2026-12-01T10:05:00.000Z"))).toBe("Tue 1 Dec, 12:05");
  });

  it("rolls the day over when Beirut is already past midnight", () => {
    expect(formatOfficeTime(new Date("2026-09-25T22:30:00.000Z"))).toBe("Sat 26 Sep, 01:30");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

  it("says just now inside the first minute", () => {
    expect(timeAgo(ago(0.5), now)).toBe("just now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(timeAgo(ago(4), now)).toBe("4 min ago");
    expect(timeAgo(ago(5 * 60), now)).toBe("5 h ago");
    expect(timeAgo(ago(47 * 60), now)).toBe("47 h ago");
    expect(timeAgo(ago(3 * 24 * 60), now)).toBe("3 days ago");
  });
});

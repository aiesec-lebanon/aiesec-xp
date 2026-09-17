import { describe, expect, it } from "vitest";

import { defaultWindowRange, toDateInputValue } from "@/lib/admin/window";

// Covers what the admin's screen falls back to when no DisplayWindow row is
// active: the current calendar month, UTC bounds, so a fresh deployment or a
// term start without a configured window still has something sensible to show.

describe("defaultWindowRange", () => {
  it("spans the 1st to the last day of the reference month, in UTC", () => {
    const { startsAt, endsAt } = defaultWindowRange(new Date("2026-02-15T10:00:00.000Z"));

    expect(toDateInputValue(startsAt)).toBe("2026-02-01");
    expect(toDateInputValue(endsAt)).toBe("2026-02-28");
    expect(startsAt.getUTCHours()).toBe(0);
    expect(endsAt.getUTCHours()).toBe(23);
  });

  it("handles a leap-year February", () => {
    const { endsAt } = defaultWindowRange(new Date("2024-02-01T00:00:00.000Z"));
    expect(toDateInputValue(endsAt)).toBe("2024-02-29");
  });

  it("rolls December to the correct year", () => {
    const { startsAt, endsAt } = defaultWindowRange(new Date("2025-12-31T23:59:59.000Z"));
    expect(toDateInputValue(startsAt)).toBe("2025-12-01");
    expect(toDateInputValue(endsAt)).toBe("2025-12-31");
  });
});

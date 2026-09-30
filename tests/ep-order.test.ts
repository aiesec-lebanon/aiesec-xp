import { describe, expect, it } from "vitest";

import {
  byNewest,
  displayStatus,
  isLiveApplication,
  isMemberNotEp,
  lastAction,
} from "@/lib/admin/ep-order";

const at = (iso: string) => new Date(`${iso}T09:00:00.000Z`);

describe("lastAction (D-76)", () => {
  it("takes whichever of the EP's record and applications moved last", () => {
    expect(lastAction([at("2026-08-20"), at("2026-09-25"), at("2026-09-01")])).toEqual(at("2026-09-25"));
  });

  it("ignores what EXPA did not date", () => {
    expect(lastAction([null, at("2026-08-20"), null])).toEqual(at("2026-08-20"));
    expect(lastAction([null])).toBeNull();
  });
});

describe("byNewest", () => {
  const row = (epPersonId: string, activityAt: Date | null, fullName: string | null = null) => ({
    epPersonId,
    activityAt,
    fullName,
  });

  it("puts the latest action first", () => {
    const rows = [row("1", at("2026-08-01")), row("2", at("2026-09-20")), row("3", at("2026-09-01"))];
    expect(rows.sort(byNewest).map((r) => r.epPersonId)).toEqual(["2", "3", "1"]);
  });

  it("puts an EP with no date after every dated one", () => {
    const rows = [row("1", null, "Aline"), row("2", at("2026-08-01"), "Zeina")];
    expect(rows.sort(byNewest).map((r) => r.epPersonId)).toEqual(["2", "1"]);
  });

  it("breaks a tie on the day by name, named EPs first, then by id", () => {
    const day = at("2026-09-01");
    const rows = [row("30", day), row("20", day, "Rami"), row("10", day, "Maya"), row("5", day)];
    expect(rows.sort(byNewest).map((r) => r.epPersonId)).toEqual(["10", "20", "30", "5"]);
  });
});

describe("displayStatus (D-78)", () => {
  const app = (status: string, day = "2026-09-01") => ({ status, updatedAt: at(day) });

  it("shows EXPA's own status for a sign-up", () => {
    expect(displayStatus("open", [])).toBe("open");
  });

  it("is never behind an application: measured, approved on 27 Sep while the person read accepted", () => {
    expect(displayStatus("accepted", [app("approved")])).toBe("approved");
  });

  it("names an application's stages as a person's: open is applied, matched is accepted", () => {
    expect(displayStatus("open", [app("open")])).toBe("applied");
    expect(displayStatus("open", [app("matched")])).toBe("accepted");
  });

  it("keeps the furthest stage when an EP applies again after realizing", () => {
    // Measured: realized in February, a new open application in September.
    expect(displayStatus("realized", [app("open", "2026-09-27")])).toBe("realized");
  });

  it("takes the furthest of several applications, not the latest", () => {
    expect(displayStatus("applied", [app("approved", "2026-08-01"), app("rejected", "2026-09-10")])).toBe(
      "approved"
    );
  });

  it("follows the funnel through finished and completed", () => {
    expect(displayStatus("realized", [app("finished")])).toBe("finished");
    expect(displayStatus("finished", [app("completed")])).toBe("completed");
  });

  it("shows how the latest application fell through when none is live", () => {
    expect(displayStatus("open", [app("rejected", "2026-08-01"), app("withdrawn", "2026-09-01")])).toBe(
      "withdrawn"
    );
  });

  it("keeps a broken approval visible", () => {
    expect(displayStatus("approval_broken", [])).toBe("approval_broken");
    expect(displayStatus("approval_broken", [app("approval_broken")])).toBe("approval_broken");
  });

  it("reads a deleted person as deleted, whatever their applications say", () => {
    expect(displayStatus("deleted", [app("finished")])).toBe("deleted");
  });

  it("is null when EXPA said nothing", () => {
    expect(displayStatus(null, [])).toBeNull();
  });
});

describe("isLiveApplication", () => {
  const REVERSING = ["withdrawn", "rejected"];

  it("drops withdrawn and rejected applications, whatever the case", () => {
    expect(isLiveApplication("withdrawn", REVERSING)).toBe(false);
    expect(isLiveApplication(" Rejected ", REVERSING)).toBe(false);
  });

  it("keeps every other status, including a broken approval", () => {
    for (const status of ["open", "matched", "approved", "realized", "approval_broken"]) {
      expect(isLiveApplication(status, REVERSING)).toBe(true);
    }
  });

  it("keeps an application with no status rather than guessing it away", () => {
    expect(isLiveApplication(null, REVERSING)).toBe(true);
  });
});

describe("isMemberNotEp", () => {
  const OPERATING = new Set(["182", "6550", "5854", "1735"]);
  const TERM_START = new Date("2026-08-01T00:00:00Z");
  const inTerm = { status: "active", officeId: 6550n, endDate: new Date("2027-01-31T00:00:00Z") };

  it("treats a member this term who never applied as not an EP", () => {
    expect(isMemberNotEp({ hasApplications: false, positions: [inTerm] }, OPERATING, TERM_START)).toBe(true);
  });

  it("keeps a member who has applied, since they are an EP too", () => {
    expect(isMemberNotEp({ hasApplications: true, positions: [inTerm] }, OPERATING, TERM_START)).toBe(false);
  });

  it("keeps a sign-up with no position", () => {
    expect(isMemberNotEp({ hasApplications: false, positions: [] }, OPERATING, TERM_START)).toBe(false);
  });

  it("keeps someone whose only position ended before the term", () => {
    const ended = { ...inTerm, endDate: new Date("2026-06-30T00:00:00Z") };
    expect(isMemberNotEp({ hasApplications: false, positions: [ended] }, OPERATING, TERM_START)).toBe(false);
  });
});

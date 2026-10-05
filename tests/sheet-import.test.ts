import { describe, expect, it } from "vitest";

import {
  mergeDirectory,
  normaliseLabel,
  parseCsv,
  parseDirectory,
  parseManagerCsv,
  parseSignups,
  resolveManager,
  SheetShapeError,
  type DirectoryEntry,
} from "@/lib/import/sheet-parser";

// Most of these columns are sign-up form data this system must never hold.
const HEADER =
  '"Timestamp","EP ID","Full Name","DOB","Email","Phone","Nationalities","Languages",' +
  '"University","Major","Education Level","Selected Programs","LC Assigned To",' +
  '"Function Assigned to","Exchange Sheet ID","EP Manager","Additional Notes"';

// Synthetic: never commit a real EP's data as a fixture.
const ROW =
  '"2026-03-03T19:53:58.138Z","1000001","Test Person","1990-01-01",' +
  '"test.person@example.invalid","+96100000000","testland","alpha,beta,gamma",' +
  '"Other","testing","bachelor_ongoing","7","AUB","OGX","x-1","Alex","called twice"';

const TAB = "MasterSheet";

describe("parseCsv", () => {
  it("keeps a quoted field containing commas in one piece", () => {
    const [row] = parseCsv('"a","b,c","d"');
    expect(row).toEqual(["a", "b,c", "d"]);
  });

  it("would otherwise shift every column after a comma-bearing value", () => {
    const [row] = parseCsv(ROW);
    expect(row).toHaveLength(17);
    expect(row[7]).toBe("alpha,beta,gamma");
  });

  it("unescapes a doubled quote", () => {
    expect(parseCsv('"say ""hi"""')[0][0]).toBe('say "hi"');
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("handles a newline inside a quoted field", () => {
    expect(parseCsv('"line one\nline two",x')[0]).toEqual(["line one\nline two", "x"]);
  });
});

describe("parseSignups", () => {
  it("reads the EP, its manager, LC and team", () => {
    const parsed = parseSignups(`${HEADER}\n${ROW}`, TAB);
    expect(parsed.rows).toEqual([
      { lineNumber: 2, epPersonId: 1000001n, managerLabel: "Alex", lc: "AUB", team: "OGX" },
    ]);
  });

  it("carries no sign-up form data into its output at all", () => {
    const serialised = JSON.stringify(parseSignups(`${HEADER}\n${ROW}`, TAB), (_k, v) =>
      typeof v === "bigint" ? String(v) : v
    );
    for (const leaked of [
      "Test Person",
      "1990-01-01",
      "test.person@example.invalid",
      "96100000000",
      "testland",
      "testing",
      "bachelor_ongoing",
      "called twice",
    ]) {
      expect(serialised).not.toContain(leaked);
    }
  });

  it("locates columns by header, not position", () => {
    const moved = '"EP Manager","EP ID"\n"Alex","1000001"';
    expect(parseSignups(moved, TAB).rows[0]).toMatchObject({ managerLabel: "Alex", epPersonId: 1000001n });
  });

  it("keeps an EP with no manager, which the sheet credits to nobody", () => {
    const parsed = parseSignups('"EP ID","EP Manager"\n"1000001",""', TAB);
    expect(parsed.rows[0]).toMatchObject({ managerLabel: "", lc: "", team: "" });
    expect(parsed.problems).toHaveLength(0);
  });

  it("recognises another tab, which Google returns for a tab name it does not have", () => {
    // Google answers an unknown tab name with 200 and the first tab's rows.
    const otherTab = '"Timestamp","EP ID","Full Name","LC"\n"x","1000001","Test Person","AUB"';
    expect(() => parseSignups(otherTab, TAB)).toThrow(/"EP Manager"/);
  });

  it("reports an EP ID that is not a number instead of importing it", () => {
    const parsed = parseSignups('"EP ID","EP Manager"\n"not-a-number","Alex"', TAB);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.problems[0].reason).toBe("INVALID_EP_ID");
  });

  it("reports a row with no EP ID", () => {
    const parsed = parseSignups('"EP ID","EP Manager"\n"","Alex"', TAB);
    expect(parsed.problems[0].reason).toBe("MISSING_EP_ID");
  });

  it("reports line numbers as the admin sees them in the sheet", () => {
    const parsed = parseSignups('"EP ID","EP Manager"\n"1","a"\n"2","b"', TAB);
    expect(parsed.rows.map((row) => row.lineNumber)).toEqual([2, 3]);
  });

  it("skips blank rows left at the end of a sheet", () => {
    const parsed = parseSignups('"EP ID","EP Manager"\n"1","a"\n"",""\n', TAB);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.problems).toHaveLength(0);
  });

  it("rejects an empty tab", () => {
    expect(() => parseSignups("", TAB)).toThrow(SheetShapeError);
  });
});

describe("normaliseLabel", () => {
  it("ignores case, accents and spacing", () => {
    expect(normaliseLabel("  Zoé   T ")).toBe(normaliseLabel("zoe t"));
  });

  it("keeps an initial, which is what tells two people apart", () => {
    expect(normaliseLabel("Jordan M")).not.toBe(normaliseLabel("Jordan K"));
  });
});

// Sheet7 as the MC keeps it: A = LC, B = Team, C = EP Manager Name, D = EXPA ID.
const DIRECTORY =
  '"LC","Team","EP Manager Name","EXPA ID"\n"AUB","OGX","Alex","2000001"\n"LAU","MOGX","Jordan M","2000002"';

describe("parseDirectory", () => {
  it("reads each manager's LC, team, name and EXPA ID", () => {
    expect(parseDirectory(DIRECTORY, "Sheet7").entries).toEqual([
      { name: "Alex", lc: "AUB", team: "OGX", memberId: 2000001n, source: "SHEET" },
      { name: "Jordan M", lc: "LAU", team: "MOGX", memberId: 2000002n, source: "SHEET" },
    ]);
  });

  it("reads the tab as it is today: headers and nobody yet", () => {
    expect(parseDirectory('"LC","Team","EP Manager Name","EXPA ID"', "Sheet7").entries).toEqual([]);
  });

  it("recognises another tab, which Google returns for a tab name it does not have", () => {
    expect(() => parseDirectory(`${HEADER}\n${ROW}`, "Sheet7")).toThrow(/no "Sheet7" tab/);
  });

  it("lists managers with no EXPA ID yet", () => {
    const directory = parseDirectory('"EP Manager Name","EXPA ID"\n"Alex",""\n"Sam","2000003"', "Sheet7");
    expect(directory.missingIds).toEqual(["Alex"]);
    expect(directory.entries).toHaveLength(1);
  });

  it("reports an EXPA ID that is not a number", () => {
    const directory = parseDirectory('"EP Manager Name","EXPA ID"\n"Robin","n/a"', "Sheet7");
    expect(directory.invalid[0].lineNumber).toBe(2);
    expect(directory.entries).toHaveLength(0);
  });
});

describe("parseManagerCsv", () => {
  it("reads the same columns as Sheet7, so one template serves both", () => {
    expect(parseManagerCsv(DIRECTORY).entries).toEqual(parseDirectory(DIRECTORY, "Sheet7").entries);
  });

  it("finds the LC column behind Excel's byte-order mark", () => {
    const entries = parseManagerCsv(`\uFEFF${DIRECTORY}`).entries;
    expect(entries[0].lc).toBe("AUB");
  });

  it("finds columns by header, in any order", () => {
    expect(parseManagerCsv("EXPA ID,EP Manager Name\r\n2000001,Alex\r\n").entries).toEqual([
      { name: "Alex", lc: "", team: "", memberId: 2000001n, source: "SHEET" },
    ]);
  });

  it("explains the expected columns when they are missing", () => {
    expect(() => parseManagerCsv("Name,ID\nAlex,2000001")).toThrow(/"EP Manager Name" and "EXPA ID"/);
  });
});

function entry(name: string, lc: string, team: string, memberId: bigint, source: DirectoryEntry["source"] = "SHEET") {
  return { name, lc, team, memberId, source };
}

describe("resolveManager", () => {
  const row = (managerLabel: string, lc = "", team = "") => ({ managerLabel, lc, team });

  it("matches a name listed once, whatever its LC and team", () => {
    const directory = [entry("Alex", "AUB", "OGX", 1n)];
    expect(resolveManager(directory, row("alex", "LAU", "MOGX"))).toEqual({
      kind: "matched",
      memberId: 1n,
      source: "SHEET",
    });
  });

  it("uses the LC when the same name belongs to two members", () => {
    const directory = [entry("Robin", "AUB", "OGX", 1n), entry("Robin", "LAU", "OGX", 2n)];
    expect(resolveManager(directory, row("Robin", "LAU", "OGX"))).toMatchObject({ memberId: 2n });
  });

  it("then the team, when the LC is shared too", () => {
    const directory = [entry("Robin", "AUB", "OGX", 1n), entry("Robin", "AUB", "MOGX", 2n)];
    expect(resolveManager(directory, row("Robin", "AUB", "MOGX"))).toMatchObject({ memberId: 2n });
  });

  it("matches nobody when the LC and team cannot tell them apart", () => {
    const directory = [entry("Robin", "AUB", "OGX", 1n), entry("Robin", "AUB", "OGX", 2n)];
    expect(resolveManager(directory, row("Robin", "AUB", "OGX"))).toEqual({ kind: "ambiguous" });
  });

  it("matches nobody when the row gives no LC or team to choose by", () => {
    const directory = [entry("Robin", "AUB", "OGX", 1n), entry("Robin", "LAU", "OGX", 2n)];
    expect(resolveManager(directory, row("Robin"))).toEqual({ kind: "ambiguous" });
  });

  it("treats one member listed twice as one match", () => {
    const directory = [entry("Robin", "AUB", "OGX", 1n), entry("Robin", "LAU", "OGX", 1n)];
    expect(resolveManager(directory, row("Robin"))).toMatchObject({ memberId: 1n });
  });

  it("reports a name nobody lists", () => {
    expect(resolveManager([entry("Alex", "", "", 1n)], row("Sam"))).toEqual({ kind: "unlisted" });
  });
});

describe("mergeDirectory", () => {
  it("lets a match made on the console replace the sheet's for the same name, LC and team", () => {
    const merged = mergeDirectory(
      [entry("Robin", "AUB", "OGX", 1n), entry("Robin", "LAU", "OGX", 2n)],
      [entry("robin", "aub", "ogx", 3n, "CONSOLE")]
    );
    expect(resolveManager(merged, { managerLabel: "Robin", lc: "AUB", team: "OGX" })).toEqual({
      kind: "matched",
      memberId: 3n,
      source: "CONSOLE",
    });
    expect(resolveManager(merged, { managerLabel: "Robin", lc: "LAU", team: "OGX" })).toMatchObject({ memberId: 2n });
  });

  it("fills a name the sheet does not list", () => {
    const merged = mergeDirectory([], [entry("Sam", "LAU", "OGX", 4n, "CONSOLE")]);
    expect(resolveManager(merged, { managerLabel: "Sam", lc: "LAU", team: "OGX" })).toMatchObject({ memberId: 4n });
  });
});

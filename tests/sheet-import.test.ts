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

// The MC sheet's MasterSheet header, as exported. Most of these columns are
// sign-up form data this system must never hold.
const HEADER =
  '"Timestamp","EP ID","Full Name","DOB","Email","Phone","Nationalities","Languages",' +
  '"University","Major","Education Level","Selected Programs","LC Assigned To",' +
  '"Function Assigned to","Exchange Sheet ID","EP Manager","Additional Notes"';

// Synthetic. The shape mirrors a real export -- the same columns, and a
// comma-bearing Languages value -- but no real EP's data is used as a fixture:
// a test file is committed, and committing someone's date of birth to prove a
// parser ignores it would be the exact failure the parser exists to prevent.
const ROW =
  '"2026-03-03T19:53:58.138Z","6023224","Test Person","1990-01-01",' +
  '"test.person@example.invalid","+96100000000","testland","alpha,beta,gamma",' +
  '"Other","testing","bachelor_ongoing","7","AUB","OGX","x-1","Sirine","called twice"';

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

describe("parseSignups (D-80)", () => {
  it("reads the EP, its manager, LC and team", () => {
    const parsed = parseSignups(`${HEADER}\n${ROW}`, TAB);
    expect(parsed.rows).toEqual([
      { lineNumber: 2, epPersonId: 6023224n, managerLabel: "Sirine", lc: "AUB", team: "OGX" },
    ]);
  });

  it("carries no sign-up form data into its output at all (D-42)", () => {
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
    const moved = '"EP Manager","EP ID"\n"Sirine","6023224"';
    expect(parseSignups(moved, TAB).rows[0]).toMatchObject({ managerLabel: "Sirine", epPersonId: 6023224n });
  });

  it("keeps an EP with no manager, which the sheet credits to nobody", () => {
    const parsed = parseSignups('"EP ID","EP Manager"\n"6023224",""', TAB);
    expect(parsed.rows[0]).toMatchObject({ managerLabel: "", lc: "", team: "" });
    expect(parsed.problems).toHaveLength(0);
  });

  it("recognises another tab, which Google returns for a tab name it does not have", () => {
    // Measured: an unknown tab name answers 200 with the first tab's rows.
    const otherTab = '"Timestamp","EP ID","Full Name","LC"\n"x","6023224","Test Person","AUB"';
    expect(() => parseSignups(otherTab, TAB)).toThrow(/"EP Manager"/);
  });

  it("reports an EP ID that is not a number instead of importing it", () => {
    const parsed = parseSignups('"EP ID","EP Manager"\n"not-a-number","Sirine"', TAB);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.problems[0].reason).toBe("INVALID_EP_ID");
  });

  it("reports a row with no EP ID", () => {
    const parsed = parseSignups('"EP ID","EP Manager"\n"","Sirine"', TAB);
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
    expect(normaliseLabel("  Léa   N ")).toBe(normaliseLabel("lea n"));
  });

  it("keeps an initial, which is what tells two people apart", () => {
    expect(normaliseLabel("Ahmad M")).not.toBe(normaliseLabel("Ahmad K"));
  });
});

// Sheet7 as the MC keeps it: A = LC, B = Team, C = EP Manager Name, D = EXPA ID.
const DIRECTORY =
  '"LC","Team","EP Manager Name","EXPA ID"\n"AUB","OGX","Sirine","5663710"\n"LAU","MOGX","Ahmad M","5194055"';

describe("parseDirectory (D-80)", () => {
  it("reads each manager's LC, team, name and EXPA ID", () => {
    expect(parseDirectory(DIRECTORY, "Sheet7").entries).toEqual([
      { name: "Sirine", lc: "AUB", team: "OGX", memberId: 5663710n, source: "SHEET" },
      { name: "Ahmad M", lc: "LAU", team: "MOGX", memberId: 5194055n, source: "SHEET" },
    ]);
  });

  it("reads the tab as it is today: headers and nobody yet", () => {
    expect(parseDirectory('"LC","Team","EP Manager Name","EXPA ID"', "Sheet7").entries).toEqual([]);
  });

  it("recognises another tab, which Google returns for a tab name it does not have", () => {
    expect(() => parseDirectory(`${HEADER}\n${ROW}`, "Sheet7")).toThrow(/no "Sheet7" tab/);
  });

  it("lists managers with no EXPA ID yet", () => {
    const directory = parseDirectory('"EP Manager Name","EXPA ID"\n"Sirine",""\n"Maram","5790695"', "Sheet7");
    expect(directory.missingIds).toEqual(["Sirine"]);
    expect(directory.entries).toHaveLength(1);
  });

  it("reports an EXPA ID that is not a number", () => {
    const directory = parseDirectory('"EP Manager Name","EXPA ID"\n"Ali","n/a"', "Sheet7");
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
    expect(parseManagerCsv("EXPA ID,EP Manager Name\r\n5663710,Sirine\r\n").entries).toEqual([
      { name: "Sirine", lc: "", team: "", memberId: 5663710n, source: "SHEET" },
    ]);
  });

  it("explains the expected columns when they are missing", () => {
    expect(() => parseManagerCsv("Name,ID\nSirine,5663710")).toThrow(/"EP Manager Name" and "EXPA ID"/);
  });
});

function entry(name: string, lc: string, team: string, memberId: bigint, source: DirectoryEntry["source"] = "SHEET") {
  return { name, lc, team, memberId, source };
}

describe("resolveManager (D-80)", () => {
  const row = (managerLabel: string, lc = "", team = "") => ({ managerLabel, lc, team });

  it("matches a name listed once, whatever its LC and team", () => {
    const directory = [entry("Sirine", "AUB", "OGX", 1n)];
    expect(resolveManager(directory, row("sirine", "LAU", "MOGX"))).toEqual({
      kind: "matched",
      memberId: 1n,
      source: "SHEET",
    });
  });

  it("uses the LC when the same name belongs to two members", () => {
    const directory = [entry("Ali", "AUB", "OGX", 1n), entry("Ali", "LAU", "OGX", 2n)];
    expect(resolveManager(directory, row("Ali", "LAU", "OGX"))).toMatchObject({ memberId: 2n });
  });

  it("then the team, when the LC is shared too", () => {
    const directory = [entry("Ali", "AUB", "OGX", 1n), entry("Ali", "AUB", "MOGX", 2n)];
    expect(resolveManager(directory, row("Ali", "AUB", "MOGX"))).toMatchObject({ memberId: 2n });
  });

  it("matches nobody when the LC and team cannot tell them apart", () => {
    const directory = [entry("Ali", "AUB", "OGX", 1n), entry("Ali", "AUB", "OGX", 2n)];
    expect(resolveManager(directory, row("Ali", "AUB", "OGX"))).toEqual({ kind: "ambiguous" });
  });

  it("matches nobody when the row gives no LC or team to choose by", () => {
    const directory = [entry("Ali", "AUB", "OGX", 1n), entry("Ali", "LAU", "OGX", 2n)];
    expect(resolveManager(directory, row("Ali"))).toEqual({ kind: "ambiguous" });
  });

  it("treats one member listed twice as one match", () => {
    const directory = [entry("Ali", "AUB", "OGX", 1n), entry("Ali", "LAU", "OGX", 1n)];
    expect(resolveManager(directory, row("Ali"))).toMatchObject({ memberId: 1n });
  });

  it("reports a name nobody lists", () => {
    expect(resolveManager([entry("Sirine", "", "", 1n)], row("Maram"))).toEqual({ kind: "unlisted" });
  });
});

describe("mergeDirectory (D-80)", () => {
  it("lets a match made on the console replace the sheet's for the same name, LC and team", () => {
    const merged = mergeDirectory(
      [entry("Ali", "AUB", "OGX", 1n), entry("Ali", "LAU", "OGX", 2n)],
      [entry("ali", "aub", "ogx", 3n, "CONSOLE")]
    );
    expect(resolveManager(merged, { managerLabel: "Ali", lc: "AUB", team: "OGX" })).toEqual({
      kind: "matched",
      memberId: 3n,
      source: "CONSOLE",
    });
    expect(resolveManager(merged, { managerLabel: "Ali", lc: "LAU", team: "OGX" })).toMatchObject({ memberId: 2n });
  });

  it("fills a name the sheet does not list", () => {
    const merged = mergeDirectory([], [entry("Maram", "LAU", "OGX", 4n, "CONSOLE")]);
    expect(resolveManager(merged, { managerLabel: "Maram", lc: "LAU", team: "OGX" })).toMatchObject({ memberId: 4n });
  });
});

import { describe, expect, it } from "vitest";

import {
  indexAliases,
  normalise,
  resolveLabel,
  scoreCandidate,
  suggestMembers,
  type MemberCandidate,
} from "@/lib/import/name-matching";
import { parseCsv, parseSheet, SheetShapeError } from "@/lib/import/sheet-parser";

// The real header, as exported by the MC's sheet. Ten of these thirteen columns
// are sign-up form data this system must never hold.
const HEADER =
  '"Responsible Member","Timestamp","EP ID","Full Name","DOB","Email","Phone",' +
  '"Nationalities","Languages","University","Major","Education Level","Selected Programs"';

// Synthetic. The shape mirrors a real export -- the same thirteen columns, and a
// comma-bearing Languages value -- but no real EP's data is used as a fixture:
// a test file is committed, and committing someone's date of birth to prove a
// parser ignores it would be the exact failure the parser exists to prevent.
const ROW =
  '"Sirine","2026-03-03T19:53:58.138Z","6023224","Test Person","1990-01-01",' +
  '"test.person@example.invalid","+96100000000","testland","alpha,beta,gamma",' +
  '"Other","testing","bachelor_ongoing","7"';

describe("parseCsv", () => {
  it("keeps a quoted field containing commas in one piece", () => {
    const [row] = parseCsv('"a","b,c","d"');
    expect(row).toEqual(["a", "b,c", "d"]);
  });

  it("would otherwise shift every column after a comma-bearing value", () => {
    const [row] = parseCsv(ROW);
    // The Languages value is one field; a naive split would make it three and
    // move "Selected Programs" into the wrong column.
    expect(row).toHaveLength(13);
    expect(row[8]).toBe("alpha,beta,gamma");
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

describe("parseSheet", () => {
  it("reads a real row", () => {
    const parsed = parseSheet(`${HEADER}\n${ROW}`);
    expect(parsed.rows).toEqual([
      { lineNumber: 2, managerLabel: "Sirine", epPersonId: 6023224n },
    ]);
  });

  it("returns only the responsible member and the EP id", () => {
    const [row] = parseSheet(`${HEADER}\n${ROW}`).rows;
    expect(Object.keys(row).sort()).toEqual(["epPersonId", "lineNumber", "managerLabel"]);
  });

  it("carries no sign-up form data into its output at all (D-42)", () => {
    const serialised = JSON.stringify(parseSheet(`${HEADER}\n${ROW}`), (_k, v) =>
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
    ]) {
      expect(serialised).not.toContain(leaked);
    }
  });

  it("locates columns by header, not position", () => {
    const moved = '"EP ID","Responsible Member"\n"6023224","Sirine"';
    expect(parseSheet(moved).rows[0]).toMatchObject({
      managerLabel: "Sirine",
      epPersonId: 6023224n,
    });
  });

  it("refuses a sheet missing a required column rather than importing the wrong one", () => {
    expect(() => parseSheet('"Timestamp","Full Name"\n"x","y"')).toThrow(SheetShapeError);
  });

  it("names the missing column so an admin can fix the sheet", () => {
    expect(() => parseSheet('"EP ID"\n"1"')).toThrow(/Responsible Member/);
  });

  it("reports a non-numeric EP id instead of importing it", () => {
    const parsed = parseSheet(`${HEADER.slice(0, 40)}\n"Sirine","x","not-a-number"`);
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.problems[0].reason).toBe("INVALID_EP_ID");
  });

  it("reports a row with no EP id", () => {
    const parsed = parseSheet('"Responsible Member","EP ID"\n"Sirine",""');
    expect(parsed.problems[0].reason).toBe("MISSING_EP_ID");
  });

  it("reports a row with no responsible member", () => {
    const parsed = parseSheet('"Responsible Member","EP ID"\n"","6023224"');
    expect(parsed.problems[0].reason).toBe("MISSING_MANAGER");
  });

  it("reports line numbers as the admin sees them in the sheet", () => {
    const parsed = parseSheet('"Responsible Member","EP ID"\n"a","1"\n"b","2"');
    expect(parsed.rows.map((row) => row.lineNumber)).toEqual([2, 3]);
  });

  it("skips blank rows left at the end of a sheet", () => {
    const parsed = parseSheet('"Responsible Member","EP ID"\n"a","1"\n"",""\n');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.problems).toHaveLength(0);
  });

  it("collects the distinct manager labels for alias mapping", () => {
    const parsed = parseSheet(
      '"Responsible Member","EP ID"\n"Sirine","1"\n"Najlaa","2"\n"Sirine","3"'
    );
    expect(parsed.managerLabels).toEqual(["Najlaa", "Sirine"]);
  });

  it("rejects an empty sheet", () => {
    expect(() => parseSheet("")).toThrow(SheetShapeError);
  });
});

describe("name matching", () => {
  const members: MemberCandidate[] = [
    { id: 1n, fullName: "Sirine Haddad" },
    { id: 2n, fullName: "Lea Nakhle" },
    { id: 3n, fullName: "Lea Moussa" },
    { id: 4n, fullName: "Ahmad Mansour" },
    { id: 5n, fullName: "Ahmad Khalil" },
    { id: 6n, fullName: "Najlaa Fares" },
  ];

  it("normalises accents, so Lea matches Léa", () => {
    expect(normalise("Léa")).toBe(normalise("Lea"));
  });

  it("suggests the one member whose first name matches", () => {
    const [top] = suggestMembers("Sirine", members);
    expect(top.member.id).toBe(1n);
  });

  it("offers both when a bare first name is ambiguous", () => {
    const suggestions = suggestMembers("Lea", members);
    expect(suggestions.map((s) => s.member.id).sort()).toEqual([2n, 3n]);
  });

  it("uses the surname initial to pick the right one", () => {
    const [top] = suggestMembers("Lea N", members);
    expect(top.member.id).toBe(2n);
  });

  it("excludes the member the initial rules out, rather than ranking them lower", () => {
    expect(suggestMembers("Lea N", members).map((s) => s.member.id)).not.toContain(3n);
  });

  it("separates the two Ahmads", () => {
    expect(suggestMembers("Ahmad M", members)[0].member.id).toBe(4n);
    expect(suggestMembers("Ahmad K", members)[0].member.id).toBe(5n);
  });

  it("scores an exact full name highest", () => {
    const suggestion = scoreCandidate("Sirine Haddad", members[0]);
    expect(suggestion?.confidence).toBe(1);
  });

  it("suggests nobody for a name that matches no one", () => {
    expect(suggestMembers("Zorglub", members)).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    expect(suggestMembers("sIRINE", members)[0].member.id).toBe(1n);
  });

  it("tolerates extra whitespace from a spreadsheet cell", () => {
    expect(suggestMembers("  Sirine  ", members)[0].member.id).toBe(1n);
  });
});

describe("label resolution", () => {
  const members: MemberCandidate[] = [
    { id: 1n, fullName: "Sirine Haddad" },
    { id: 2n, fullName: "Lea Nakhle" },
  ];

  it("uses the alias when one exists", () => {
    const aliases = indexAliases([{ label: "Sirine", memberId: 1n }]);
    expect(resolveLabel("Sirine", aliases, members)).toEqual({ status: "MAPPED", memberId: 1n });
  });

  it("matches an alias regardless of case or spacing in the sheet", () => {
    const aliases = indexAliases([{ label: "Sirine", memberId: 1n }]);
    expect(resolveLabel("  sirine ", aliases, members).status).toBe("MAPPED");
  });

  it("never guesses an unmapped label into a mapping", () => {
    const resolution = resolveLabel("Lea", indexAliases([]), members);
    expect(resolution.status).toBe("UNMAPPED");
  });

  it("returns suggestions for an admin to confirm", () => {
    const resolution = resolveLabel("Lea", indexAliases([]), members);
    if (resolution.status !== "UNMAPPED") throw new Error("expected UNMAPPED");
    expect(resolution.suggestions[0].member.id).toBe(2n);
  });

  it("honours an alias that contradicts what matching would guess", () => {
    // The admin has said this label means Sirine. That decision wins.
    const aliases = indexAliases([{ label: "Lea", memberId: 1n }]);
    expect(resolveLabel("Lea", aliases, members)).toEqual({ status: "MAPPED", memberId: 1n });
  });
});

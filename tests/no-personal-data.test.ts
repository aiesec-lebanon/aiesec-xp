import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const operations = readFileSync(resolve(root, "gis/operations.graphql"), "utf8");

function modelBody(name: string): string {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (!match) throw new Error(`model ${name} not found in schema`);
  // Comments explain why the data is absent, so they must not count as matches.
  return match[1]
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function operationBody(name: string): string {
  const match = new RegExp(`query ${name}\\(?[\\s\\S]*?\\n\\}`).exec(operations);
  if (!match) throw new Error(`query ${name} not found`);
  return match[0]
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

const FORBIDDEN = /full_?name|email|phone|first_?name|last_?name|dob|gender|nationalit/i;

describe("ExchangeEvent holds no EP personal data", () => {
  const body = modelBody("ExchangeEvent");

  it("declares no name, email or phone field", () => {
    expect(body).not.toMatch(FORBIDDEN);
  });

  it("declares no opportunity title", () => {
    expect(body).not.toMatch(/opportunityTitle/);
  });

  it("still declares epPersonId, the join without which nothing is attributable", () => {
    expect(body).toMatch(/epPersonId\s+BigInt/);
  });

  it("carries only what scoring reads", () => {
    for (const dropped of ["personHomeLcId", "opportunityHomeLcId", "gisManagerIds"]) {
      expect(body).not.toContain(dropped);
    }
  });
});

describe("the sync query does not request what it must not store", () => {
  const body = operationBody("Applications");

  it("selects no EP name", () => {
    expect(body).not.toMatch(FORBIDDEN);
  });

  it("still selects the ids scoring depends on", () => {
    expect(body).toMatch(/person \{\s*\n\s*id/);
    expect(body).toMatch(/programme \{\s*\n\s*id/);
  });
});

describe("the manager sync reads ids only", () => {
  const body = operationBody("EpManagers");

  it("selects no name for the EP or their managers", () => {
    expect(body).not.toMatch(FORBIDDEN);
  });

  it("still selects the manager ids the register mirrors", () => {
    expect(body).toMatch(/managers \{\s*\n\s*id/);
  });
});

describe("no operation reads EP data for display", () => {
  it("has no EpDetails query: viewing EP data is EXPA's job", () => {
    expect(operations).not.toMatch(/query EpDetails/);
  });

  it("has no EpDirectory query: assignment happens in the sheet, not here", () => {
    expect(operations).not.toMatch(/query EpDirectory/);
  });
});

describe("the assignment register holds no EP personal data", () => {
  const body = modelBody("EpAssignment");

  it("stores no EP name: the sheet supplies an id, so a name is never needed", () => {
    expect(body).not.toMatch(FORBIDDEN);
  });

  it("stores the EP id, which is what makes the register attributable", () => {
    expect(body).toMatch(/epPersonId\s+BigInt/);
  });

  it("requires that id, so an unresolvable row is an import error not a stored gap", () => {
    expect(body).not.toMatch(/epPersonId\s+BigInt\?/);
  });
});

describe("no other model stores EP contact details", () => {
  it.each(["ScoreLedgerEntry", "RewardGrant", "ScoringAnomaly"])("%s", (model) => {
    expect(modelBody(model)).not.toMatch(FORBIDDEN);
  });
});

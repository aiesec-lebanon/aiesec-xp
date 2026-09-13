import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// D-42. EP personal data lives in EXPA and only in EXPA. These tests read the
// schema and the GIS operations as text, so adding a name column or selecting a
// name in the sync query fails here rather than being noticed after it has
// already collected a few thousand rows.

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

describe("display-time lookup", () => {
  it("is the one operation allowed to read an EP name", () => {
    expect(operationBody("EpDetails")).toMatch(/full_name/);
  });
});

describe("assignment records a name only while unresolved", () => {
  const body = modelBody("EpAssignment");

  it("keeps epFullName optional, so it can be cleared once linked", () => {
    expect(body).toMatch(/epFullName\s+String\?/);
  });

  it("holds no other contact detail", () => {
    expect(body).not.toMatch(/email|phone/i);
  });
});

describe("no other model stores EP contact details", () => {
  it.each(["ScoreLedgerEntry", "RewardGrant", "ScoringAnomaly"])("%s", (model) => {
    expect(modelBody(model)).not.toMatch(FORBIDDEN);
  });
});

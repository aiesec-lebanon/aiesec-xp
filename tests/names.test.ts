import { describe, expect, it } from "vitest";

import { characterFor } from "@/lib/design/character";
import { firstName, MC_LABEL, officeLabel, personName } from "@/lib/design/names";

describe("personName", () => {
  it.each([
    ["john doe", "John Doe"],
    ["JOHN DOE", "John Doe"],
    ["jOHN", "John"],
    ["  mia   van  berg ", "Mia Van Berg"],
    ["smith-jones", "Smith-Jones"],
    ["Jordan M", "Jordan M"],
    ["élise", "Élise"],
  ])("writes %j as %j", (raw, expected) => {
    expect(personName(raw)).toBe(expected);
  });

  it("keeps a name its owner already spelled in mixed case", () => {
    expect(personName("Casey McKenzie")).toBe("Casey McKenzie");
  });

  it("does not start a new word after an apostrophe", () => {
    expect(personName("jo'el")).toBe("Jo'el");
  });

  it("is idempotent, so formatting twice changes nothing", () => {
    expect(personName(personName("jOHN o'NEIL-smith"))).toBe(personName("jOHN o'NEIL-smith"));
  });
});

describe("firstName", () => {
  it("is the first part of the formatted name", () => {
    expect(firstName("test person")).toBe("Test");
  });
});

describe("officeLabel", () => {
  it("drops the (EXP) suffix EXPA adds", () => {
    expect(officeLabel("LC AUB (EXP)")).toBe("LC AUB");
    expect(officeLabel("LC LAU (exp)")).toBe("LC LAU");
  });

  it("leaves a name without the suffix alone", () => {
    expect(officeLabel("LC Beirut")).toBe("LC Beirut");
  });

  it("names the MC as MC", () => {
    expect(officeLabel("MC Lebanon", { isMc: true })).toBe(MC_LABEL);
    expect(officeLabel("Lebanon", { isMc: true })).toBe("MC");
  });
});

describe("characterFor", () => {
  it("draws the same default character however a name is capitalised", () => {
    expect(characterFor("test person").id).toBe(characterFor("Test Person").id);
  });
});

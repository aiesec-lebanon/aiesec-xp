import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { CONTACT_LIMITS, contactTopicLabel, replyMailto, validateContact } = await import(
  "@/lib/privacy/contact"
);
const { isOptedOut } = await import("@/lib/privacy/refs");

const VALID = {
  name: "Test Sender",
  email: "sender@example.com",
  expaId: "",
  kind: "QUESTION",
  message: "What does AIESEC XP hold about me?",
};

describe("the privacy contact form", () => {
  it("accepts a complete message and trims it", () => {
    expect(validateContact({ ...VALID, message: " Hi \n" })).toEqual({
      ok: true,
      data: { ...VALID, expaId: null, message: "Hi" },
    });
  });

  it("needs a name, a reply address and a message", () => {
    const result = validateContact({ ...VALID, name: " ", email: "", message: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["email", "message", "name"]);
  });

  it("takes an EXPA ID only as digits", () => {
    expect(validateContact({ ...VALID, expaId: "900101" }).ok).toBe(true);
    expect(validateContact({ ...VALID, expaId: "abc" }).ok).toBe(false);
  });

  it("only accepts the listed topics", () => {
    expect(validateContact({ ...VALID, kind: "SOMETHING" }).ok).toBe(false);
    expect(contactTopicLabel("OBJECTION")).toBe("Take me off the leaderboards");
  });

  it("caps the message", () => {
    const result = validateContact({ ...VALID, message: "x".repeat(CONTACT_LIMITS.message + 1) });
    expect(result.ok).toBe(false);
  });

  it("keeps the sender's name on one line", () => {
    const result = validateContact({ ...VALID, name: "Test\n\nSender" });
    expect(result.ok && result.data.name).toBe("Test Sender");
  });

  it("replies from the admin's own mail app, quoting the message", () => {
    const url = replyMailto("sender@example.com", "Line one\nLine two");
    expect(url.startsWith("mailto:sender@example.com?subject=")).toBe(true);
    const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    expect(params.get("body")).toBe("\n\n> Line one\n> Line two");
  });
});

describe("the EXPA statistical opt-out", () => {
  it("counts every truthy spelling GIS might send", () => {
    for (const value of ["true", "TRUE", "1", "yes", "t"]) expect(isOptedOut(value)).toBe(true);
  });

  it("counts anything else as not opted out", () => {
    for (const value of [null, undefined, "", "false", "0", "no"]) expect(isOptedOut(value)).toBe(false);
  });
});

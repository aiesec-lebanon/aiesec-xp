import { createHmac } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = "session-secret-value-0123456789abcdefghijklmno";
});

vi.mock("server-only", () => ({}));

const { issueSession, readSession } = await import("@/lib/auth/session");

describe("session cookie", () => {
  it("round-trips the person id", () => {
    const { value } = issueSession(6199568n);
    expect(readSession(value)?.sub).toBe("6199568");
  });

  it("rejects a tampered payload", () => {
    const { value } = issueSession(1n);
    const [, signature] = value.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "999", iat: 0, exp: Math.floor(Date.now() / 1000) + 60 })
    ).toString("base64url");

    expect(readSession(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const { value } = issueSession(1n);
    const [body] = value.split(".");
    expect(readSession(`${body}.not-the-signature`)).toBeNull();
  });

  it("rejects an unsigned payload", () => {
    const body = Buffer.from(
      JSON.stringify({ sub: "1", iat: 0, exp: Math.floor(Date.now() / 1000) + 60 })
    ).toString("base64url");
    expect(readSession(body)).toBeNull();
  });

  it("rejects a session signed with a different secret", () => {
    // Forged here rather than by swapping the environment variable: the secret
    // is read once and cached, so mutating it mid-test would prove nothing.
    const body = Buffer.from(
      JSON.stringify({ sub: "1", iat: 0, exp: Math.floor(Date.now() / 1000) + 60 })
    ).toString("base64url");
    const forged = createHmac("sha256", "an-attackers-secret-0123456789abcdefghij")
      .update(body)
      .digest("base64url");

    expect(readSession(`${body}.${forged}`)).toBeNull();
  });

  it("rejects an expired session", () => {
    const expired = Buffer.from(
      JSON.stringify({ sub: "1", iat: 0, exp: Math.floor(Date.now() / 1000) - 1 })
    ).toString("base64url");
    expect(readSession(`${expired}.anything`)).toBeNull();
  });

  it("rejects empty and malformed values", () => {
    for (const value of [undefined, "", ".", "no-separator", "..", "a.b.c"]) {
      expect(readSession(value)).toBeNull();
    }
  });

  it("does not put the OAuth token anywhere in the cookie", () => {
    const { value } = issueSession(1n);
    const decoded = Buffer.from(value.split(".")[0], "base64url").toString("utf8");
    expect(Object.keys(JSON.parse(decoded)).sort()).toEqual(["exp", "iat", "sub"]);
  });
});

import { beforeAll, describe, expect, it, vi } from "vitest";

// Architecture.md 4.3 requires a test that fails if the service token can appear
// in serialised output. This is that test. It is deliberately paranoid: the
// token has entity-wide read access to AIESEC data, so one leaked log line or
// error payload is a disclosure.

const SERVICE_TOKEN = "spike-service-token-value-0123456789abcdef";
const CLIENT_SECRET = "aiesec-client-secret-value-abcdef0123456789";
const SESSION_SECRET = "session-secret-value-0123456789abcdefghijklmno";
const CRON_SECRET = "cron-secret-value-0123456789abcdefghijklmnopq";

beforeAll(() => {
  process.env.GIS_SERVICE_TOKEN = SERVICE_TOKEN;
  process.env.AIESEC_CLIENT_SECRET = CLIENT_SECRET;
  process.env.SESSION_SECRET = SESSION_SECRET;
  process.env.CRON_SECRET = CRON_SECRET;
});

vi.mock("server-only", () => ({}));

const { redact, logger } = await import("@/lib/logger");

function serialise(value: unknown): string {
  return JSON.stringify(redact(value));
}

describe("redact", () => {
  it("removes the service token from a plain string", () => {
    const out = serialise(`Authorization: ${SERVICE_TOKEN}`);
    expect(out).not.toContain(SERVICE_TOKEN);
    expect(out).toContain("[redacted]");
  });

  it("removes every configured secret, not only the GIS token", () => {
    const out = serialise({ a: CLIENT_SECRET, b: SESSION_SECRET, c: CRON_SECRET });
    expect(out).not.toContain(CLIENT_SECRET);
    expect(out).not.toContain(SESSION_SECRET);
    expect(out).not.toContain(CRON_SECRET);
  });

  it("removes the token from a nested request-shaped object", () => {
    const out = serialise({
      request: {
        url: "https://gis-api.aiesec.org/graphql",
        headers: { Authorization: SERVICE_TOKEN, "content-type": "application/json" },
      },
    });
    expect(out).not.toContain(SERVICE_TOKEN);
  });

  it("removes the token carried on an Error message and stack", () => {
    const error = new Error(`request failed with Authorization: ${SERVICE_TOKEN}`);
    expect(serialise({ error })).not.toContain(SERVICE_TOKEN);
  });

  it("redacts by key name even when the value is not a known secret", () => {
    const out = serialise({ accessToken: "some-other-token", cookie: "xp_session=abc" });
    expect(out).not.toContain("some-other-token");
    expect(out).not.toContain("xp_session=abc");
  });

  it("survives a cyclic object rather than hanging", () => {
    const cyclic: Record<string, unknown> = { token: SERVICE_TOKEN };
    cyclic.self = cyclic;
    const out = serialise(cyclic);
    expect(out).not.toContain(SERVICE_TOKEN);
    expect(out).toContain("[circular]");
  });

  it("redacts a token appearing more than once", () => {
    const out = serialise(`${SERVICE_TOKEN} and again ${SERVICE_TOKEN}`);
    expect(out).not.toContain(SERVICE_TOKEN);
  });

  it("leaves ordinary values untouched", () => {
    expect(redact({ officeId: 182, name: "LC AUB" })).toEqual({ officeId: 182, name: "LC AUB" });
  });
});

describe("logger", () => {
  it("never emits the token, even when handed a raw error object", () => {
    const written: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((line) => {
      written.push(String(line));
    });

    logger.error("GIS request failed", {
      error: new Error(`401 for Authorization: ${SERVICE_TOKEN}`),
      headers: { Authorization: SERVICE_TOKEN },
    });

    spy.mockRestore();

    expect(written.length).toBeGreaterThan(0);
    for (const line of written) {
      expect(line).not.toContain(SERVICE_TOKEN);
    }
  });
});

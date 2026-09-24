import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { proxy } = await import("@/proxy");

// A scheduler has no session cookie; it authenticates to the cron routes with
// CRON_SECRET instead. The proxy once redirected those calls to /login like any
// anonymous visitor, so no scheduled sync ever reached its route (D-66).

describe("proxy", () => {
  it("lets a scheduled call reach /api/cron without a session", () => {
    const response = proxy(
      new NextRequest("https://xp.example/api/cron/events?cadence=hackathon", { method: "POST" })
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("still sends an anonymous visitor to sign in", () => {
    const response = proxy(new NextRequest("https://xp.example/admin/sync"));
    expect(response.headers.get("location")).toContain("/login");
  });
});

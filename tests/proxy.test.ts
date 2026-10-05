import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { proxy } = await import("@/proxy");

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

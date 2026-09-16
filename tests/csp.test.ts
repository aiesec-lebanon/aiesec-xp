import { describe, expect, it } from "vitest";

import { contentSecurityPolicy } from "@/lib/security/csp";

// Architecture.md 11 requires the policy; the 3D stack requires specific
// allowances inside it. Both halves are asserted here because the failure mode
// is silent and late: Rapier and every Draco-compressed model work in a
// development build with 'unsafe-eval' and then break in production.

function directive(policy: string, name: string): string {
  const found = policy.split("; ").find((part) => part.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} directive in policy`);
  return found;
}

const production = contentSecurityPolicy("test-nonce", false);
const development = contentSecurityPolicy("test-nonce", true);

describe("the policy carries what the 3D stack needs", () => {
  it("allows WebAssembly, which Rapier and the Draco decoder both instantiate", () => {
    expect(directive(production, "script-src")).toContain("'wasm-unsafe-eval'");
  });

  it("allows a blob worker, which is how three builds the Draco decoder", () => {
    expect(directive(production, "worker-src")).toContain("blob:");
  });

  it("allows blob and data images, which glTF textures arrive as", () => {
    const imgSrc = directive(production, "img-src");
    expect(imgSrc).toContain("blob:");
    expect(imgSrc).toContain("data:");
  });

  it("keeps fonts and models same-origin, so nothing reaches a CDN", () => {
    expect(directive(production, "font-src")).toBe("font-src 'self'");
    expect(directive(production, "connect-src")).toBe("connect-src 'self' blob:");
  });
});

describe("the policy stays strict where it matters", () => {
  it("carries the per-request nonce", () => {
    expect(directive(production, "script-src")).toContain("'nonce-test-nonce'");
  });

  it("never allows inline or eval'd script in production", () => {
    const scriptSrc = directive(production, "script-src");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("allows eval only in development, where React uses it for error stacks", () => {
    expect(directive(development, "script-src")).toContain("'unsafe-eval'");
  });

  it("permits no plugins, framing or base-tag rewriting", () => {
    expect(production).toContain("object-src 'none'");
    expect(production).toContain("frame-ancestors 'none'");
    expect(production).toContain("base-uri 'self'");
    expect(production).toContain("form-action 'self'");
  });

  it("names no host other than self", () => {
    expect(production).not.toMatch(/https?:\/\//);
  });
});

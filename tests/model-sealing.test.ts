import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { openAtRest, parseModelKey, sealAtRest, sealForTransport } from "@/lib/models/sealing";
import { openTransport } from "@/lib/models/transport";

const model = randomBytes(4096);
const key = randomBytes(32);

describe("model sealing", () => {
  it("round-trips at rest under MODEL_KEY", () => {
    const sealed = sealAtRest(model, key);
    expect(sealed.includes(model.subarray(0, 64))).toBe(false);
    expect(openAtRest(sealed, key).equals(model)).toBe(true);
  });

  it("refuses the wrong key", () => {
    expect(() => openAtRest(sealAtRest(model, key), randomBytes(32))).toThrow();
  });

  it("opens in the browser what the route seals for transport", async () => {
    const wire = sealForTransport(model);
    const opened = await openTransport(new Uint8Array(wire).buffer);
    expect(Buffer.from(opened).equals(model)).toBe(true);
  });

  it("rejects a plain .glb on the wire", async () => {
    await expect(openTransport(new Uint8Array(model).buffer)).rejects.toThrow();
  });

  it("accepts only a 32-byte base64 key", () => {
    expect(parseModelKey(`"${key.toString("base64")}"`).equals(key)).toBe(true);
    expect(() => parseModelKey(undefined)).toThrow();
    expect(() => parseModelKey(randomBytes(16).toString("base64"))).toThrow();
  });
});

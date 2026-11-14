import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";

import { modelKey } from "@/lib/env";
import { openAtRest, sealForTransport } from "@/lib/models/sealing";

const NAME = /^[a-z0-9-]{1,64}$/;
const SEALED_DIR = path.join(process.cwd(), "assets", "sealed");

type Model = { bytes: Buffer; etag: string };

const cache = new Map<string, Promise<Model | null>>();

async function decrypt(name: string): Promise<Model | null> {
  let sealed: Buffer;
  try {
    sealed = await readFile(path.join(SEALED_DIR, `${name}.bin`));
  } catch {
    return null;
  }
  const bytes = openAtRest(sealed, modelKey());
  const etag = `"${createHash("sha256").update(bytes).digest("base64url").slice(0, 22)}"`;
  return { bytes, etag };
}

function load(name: string): Promise<Model | null> {
  let hit = cache.get(name);
  if (!hit) {
    hit = decrypt(name);
    cache.set(name, hit);
    // Only found models stay cached: names are caller-chosen, so caching misses
    // would let anyone grow this map without bound.
    hit.then(
      (model) => model ?? cache.delete(name),
      () => cache.delete(name),
    );
  }
  return hit;
}

// A fetch from one of our own pages, not a URL opened in the address bar or a
// script outside the browser. Sec-Fetch-* is set by the browser and can't be
// changed from page script; the Referer fallback covers browsers without it.
function fromOwnPage(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" && request.headers.get("sec-fetch-dest") === "empty";
  const referer = request.headers.get("referer");
  return referer !== null && URL.canParse(referer) && new URL(referer).host === request.nextUrl.host;
}

const notFound = () => new Response(null, { status: 404 });

export async function GET(request: NextRequest, ctx: RouteContext<"/api/models/[name]">) {
  const { name } = await ctx.params;
  if (!NAME.test(name) || !fromOwnPage(request)) return notFound();

  const model = await load(name);
  if (!model) return notFound();

  const headers = {
    "Cache-Control": "private, no-cache",
    ETag: model.etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === model.etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Uint8Array(sealForTransport(model.bytes)), {
    headers: { ...headers, "Content-Type": "application/octet-stream" },
  });
}

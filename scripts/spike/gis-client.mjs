import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REDACTED = "[redacted]";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(".env.local not found. Copy .env.example to .env.local and fill it in.");
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

loadEnvLocal();

const endpoint = process.env.GIS_GRAPHQL_URL;
const token = process.env.GIS_SERVICE_TOKEN;
export const MC_OFFICE_ID = Number(process.env.MC_OFFICE_ID);

if (!endpoint) throw new Error("GIS_GRAPHQL_URL is not set");
if (!token) throw new Error("GIS_SERVICE_TOKEN is not set");
if (!Number.isFinite(MC_OFFICE_ID)) throw new Error("MC_OFFICE_ID is not a number");

// The token must never reach stdout, a report file, or an error message. Every
// string this module emits passes through here first.
export function redact(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) return text;
  return text.split(token).join(REDACTED);
}

let callCount = 0;
const timings = [];

// auth-template convention: the raw token as Authorization, no Bearer prefix.
export async function gis(query, variables) {
  const startedAt = Date.now();
  callCount += 1;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify({ query, variables }),
  });

  const elapsedMs = Date.now() - startedAt;
  const bodyText = await response.text();
  timings.push(elapsedMs);

  const rateLimitHeaders = {};
  for (const [key, value] of response.headers.entries()) {
    if (/ratelimit|retry-after|x-request-id/i.test(key)) rateLimitHeaders[key] = value;
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      status: response.status,
      elapsedMs,
      rateLimitHeaders,
      errors: [`non-JSON response: ${redact(bodyText).slice(0, 400)}`],
    };
  }

  const errors = (body.errors ?? []).map((e) => redact(e?.message ?? "unknown"));
  return {
    ok: response.ok && errors.length === 0,
    status: response.status,
    elapsedMs,
    rateLimitHeaders,
    errors: errors.length ? errors : undefined,
    data: body.data,
  };
}

export function callStats() {
  const sorted = [...timings].sort((a, b) => a - b);
  return {
    calls: callCount,
    medianMs: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    maxMs: sorted.length ? sorted[sorted.length - 1] : null,
  };
}

import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isAuthorisedCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Deny when unset: an open sync trigger would let anyone burn the GIS rate limit.
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

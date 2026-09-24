import "server-only";

import { timingSafeEqual } from "node:crypto";

// Cron routes are the one authenticated surface with no user behind it, so they
// carry a shared secret instead. The GitHub Actions workflows in
// .github/workflows send it as a Bearer token (D-66).

export function isAuthorisedCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // Absent secret denies rather than allows: an unprotected sync trigger is a
  // denial-of-service handle on the GIS rate limit.
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

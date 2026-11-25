import "server-only";

// A fixed-window limiter in memory. Each server instance counts on its own, so
// it only blunts bursts; anything that must hold across instances also counts
// rows in the database. No paid service is involved.

const LIMITS = {
  signIn: { max: 20, windowSeconds: 15 * 60 },
  privacyContact: { max: 5, windowSeconds: 60 * 60 },
  export: { max: 10, windowSeconds: 60 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(name: LimitName, key: string): { allowed: boolean; resetAt: number } {
  const { max, windowSeconds } = LIMITS[name];
  const now = Date.now();
  const bucketKey = `${name}:${key}`;
  let bucket = buckets.get(bucketKey);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowSeconds * 1000 };
    buckets.set(bucketKey, bucket);
  }
  bucket.count += 1;
  return { allowed: bucket.count <= max, resetAt: bucket.resetAt };
}

/** Spoofable behind an arbitrary proxy, so only ever used for throttling. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || null;
}

export const __testing = { clear: () => buckets.clear() };

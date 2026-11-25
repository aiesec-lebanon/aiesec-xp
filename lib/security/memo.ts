import "server-only";

const entries = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

/**
 * Shares one result per key for `ms` within a server instance. For public
 * pages whose data costs GIS or analytics calls, so reloading them in a loop
 * cannot turn into a stream of calls on the service token.
 */
export function memoFor<T>(key: string, ms: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.expiresAt > now) return hit.value as Promise<T>;
  const value = load();
  entries.set(key, { expiresAt: now + ms, value });
  value.catch(() => entries.delete(key));
  return value;
}

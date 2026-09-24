// The order of the assignment console: newest application first, because an
// admin works the list from the top and the EPs who most need a decision are
// the ones who just applied. Pure, so tests/ep-order.test.ts covers it directly.

type FunnelEventLike = { eventType: string; occurredAt: Date };

/**
 * When the EP last applied: the latest of their APL events. Null when none of
 * their applications was created inside the collected range -- an EP approved
 * this term on an application from before the term start holds no APL here.
 */
export function latestApplication(events: readonly FunnelEventLike[]): Date | null {
  let latest: Date | null = null;
  for (const event of events) {
    if (event.eventType === "APL" && (!latest || event.occurredAt > latest)) {
      latest = event.occurredAt;
    }
  }
  return latest;
}

type Orderable = { appliedAt: Date | null; fullName: string | null; epPersonId: string };

/** Newest application first; an EP with no application in range after every dated one, then by name, then id. */
export function byNewestApplication(a: Orderable, b: Orderable): number {
  if (a.appliedAt && b.appliedAt) {
    const newer = b.appliedAt.getTime() - a.appliedAt.getTime();
    if (newer !== 0) return newer;
  } else if (a.appliedAt || b.appliedAt) {
    return a.appliedAt ? -1 : 1;
  }

  if (a.fullName && b.fullName) {
    const byName = a.fullName.localeCompare(b.fullName);
    if (byName !== 0) return byName;
  } else if (a.fullName || b.fullName) {
    return a.fullName ? -1 : 1;
  }

  return a.epPersonId.localeCompare(b.epPersonId);
}

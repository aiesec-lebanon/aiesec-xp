// Pure rules for the assignment console: the order it lists EPs in, which of
// an EP's applications are still live, what status it shows, and who is a
// member rather than an EP. Kept free of I/O so tests/ep-order.test.ts covers
// them directly.

import { isInTermPosition, type PositionInput } from "@/lib/auth/roles";

/**
 * When anything last happened to the EP: their own record or any application.
 * Both, because a person's `updated_at` does not move with their applications
 * (D-76).
 */
export function lastAction(dates: readonly (Date | null)[]): Date | null {
  let latest: Date | null = null;
  for (const date of dates) {
    if (date && (!latest || date > latest)) latest = date;
  }
  return latest;
}

type Orderable = { activityAt: Date | null; fullName: string | null; epPersonId: string };

/**
 * Newest last action first, so whoever EXPA last touched sits at the top. An
 * EP with no date sorts after every dated one, then by name, then id.
 */
export function byNewest(a: Orderable, b: Orderable): number {
  if (a.activityAt && b.activityAt) {
    const newer = b.activityAt.getTime() - a.activityAt.getTime();
    if (newer !== 0) return newer;
  } else if (a.activityAt || b.activityAt) {
    return a.activityAt ? -1 : 1;
  }

  if (a.fullName && b.fullName) {
    const byName = a.fullName.localeCompare(b.fullName);
    if (byName !== 0) return byName;
  } else if (a.fullName || b.fullName) {
    return a.fullName ? -1 : 1;
  }

  return a.epPersonId.localeCompare(b.epPersonId);
}

/**
 * An application still counts towards an EP's active product unless its
 * status is one that reverses an APL (D-41: withdrawn, rejected) -- the same
 * list, from the same config, so "didn't count" means one thing everywhere.
 */
export function isLiveApplication(status: string | null, reversingStatuses: readonly string[]): boolean {
  const normalised = status?.trim().toLowerCase() ?? "";
  return !reversingStatuses.some((value) => value.trim().toLowerCase() === normalised);
}

/**
 * EXPA's funnel, in order: open > applied > accepted > approved > realized >
 * finished > completed. Remote realization sits with realization (D-29).
 */
export const FUNNEL_STATUSES = [
  "open",
  "applied",
  "accepted",
  "approved",
  "realized",
  "finished",
  "completed",
] as const;

const FUNNEL_RANK: Readonly<Record<string, number>> = {
  ...Object.fromEntries(FUNNEL_STATUSES.map((status, index) => [status, index])),
  remote_realized: FUNNEL_STATUSES.indexOf("realized"),
};

// An application names two stages differently from a person: an open
// application is an applied EP, a matched one an accepted EP.
const AS_PERSON_STATUS: Readonly<Record<string, string>> = { open: "applied", matched: "accepted" };

function clean(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase().replaceAll(" ", "_");
}

/**
 * The status the console shows for an EP (D-78): EXPA's own person status,
 * except never behind any of their applications. `Person.status` lags -- an
 * EP whose application was approved on 27 Sep still read "accepted" three days
 * later -- while an application's status moves with the application.
 *
 * With nothing past a sign-up anywhere, a deleted person reads deleted, and an
 * EP whose applications all fell through reads as the latest of them did.
 */
export function displayStatus(
  personStatus: string | null,
  applications: readonly { status: string | null; updatedAt: Date | null }[]
): string | null {
  const person = clean(personStatus);
  if (person === "deleted") return "deleted";

  let best: string | null = (FUNNEL_RANK[person] ?? 0) > 0 ? person : null;
  for (const application of applications) {
    const status = clean(application.status);
    const mapped = AS_PERSON_STATUS[status] ?? status;
    const rank = FUNNEL_RANK[mapped];
    if (rank !== undefined && rank > 0 && (best === null || rank > FUNNEL_RANK[best]!)) best = mapped;
  }
  if (best) return best;

  const latest = [...applications].sort(
    (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
  )[0];
  const fallen = clean(latest?.status);
  if (fallen) return fallen;

  return person || null;
}

/**
 * A member this term who has never applied is not an EP (D-72), so has no row
 * to be credited on. A member who has applied is an EP like any other and
 * keeps theirs.
 */
export function isMemberNotEp(
  person: {
    hasApplications: boolean;
    positions: readonly Pick<PositionInput, "status" | "officeId" | "endDate">[];
  },
  operatingOfficeIds: ReadonlySet<string>,
  termStart: Date
): boolean {
  if (person.hasApplications) return false;
  return person.positions.some((position) =>
    isInTermPosition(position, operatingOfficeIds, termStart)
  );
}

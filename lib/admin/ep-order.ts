import { isInTermPosition, type PositionInput } from "@/lib/auth/roles";

// A person's updated_at does not move with their applications, so both are needed.
export function lastAction(dates: readonly (Date | null)[]): Date | null {
  let latest: Date | null = null;
  for (const date of dates) {
    if (date && (!latest || date > latest)) latest = date;
  }
  return latest;
}

type Orderable = { activityAt: Date | null; fullName: string | null; epPersonId: string };

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

// Same reversing-status list as scoring, so "didn't count" means one thing everywhere.
export function isLiveApplication(status: string | null, reversingStatuses: readonly string[]): boolean {
  const normalised = status?.trim().toLowerCase() ?? "";
  return !reversingStatuses.some((value) => value.trim().toLowerCase() === normalised);
}

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

// EXPA's Person.status lags its applications, so never show it behind any of them.
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

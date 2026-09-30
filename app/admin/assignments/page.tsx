import Link from "next/link";

import { byNewest } from "@/lib/admin/ep-order";
import { isActiveCredit } from "@/lib/assignments/plan";
import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { memberAvatars } from "@/lib/design/avatar";
import { formatDisplay, toIso } from "@/lib/design/calendar";
import { personName } from "@/lib/design/names";
import { timeAgo } from "@/lib/design/time-labels";
import { expaEpDirectory, type ExpaEp } from "@/lib/gis/expa-ep-context";
import { importAssignments } from "@/lib/import/run-import";
import { inTermRoles } from "@/lib/org/members";
import { readRoleShares } from "@/lib/scoring/config";
import { creditShares } from "@/lib/scoring/shares";
import { syncJobState } from "@/lib/sync/jobs";
import { currentWindow } from "@/lib/term";

import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { ImportButtons } from "./controls";
import { SheetNames } from "./sheet-names";
import {
  AssignmentsTable,
  type AssignmentRow,
  type CreditSource,
  type ManagerChip,
} from "./assignments-table";

export const dynamic = "force-dynamic";
// The EP table's Refresh and every credit change are server actions, which run
// under this page's limit.
export const maxDuration = 300;

type Credit = {
  epPersonId: bigint;
  memberId: bigint;
  fromExpa: boolean;
  fromSheet: boolean;
  fromAdmin: boolean;
  isMain: boolean;
  removedAt: Date | null;
};

function sourcesOf(credit: Credit): CreditSource[] {
  return [
    ...(credit.fromExpa ? (["EXPA"] as const) : []),
    ...(credit.fromSheet ? (["SHEET"] as const) : []),
    ...(credit.fromAdmin ? (["ADMIN"] as const) : []),
  ];
}

function dateLabel(prefix: string, date: Date | null): string | null {
  return date ? `${prefix} ${formatDisplay(toIso(date))}` : null;
}

export default async function AssignmentsAdminPage() {
  const currentUser = await requireMemberPage("/admin/assignments");

  if (currentUser.role !== "ADMIN") {
    return (
      <main className="flex min-h-full shrink-0 flex-col items-center justify-center gap-3 bg-wall px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Not available</h1>
        <p className="text-sm text-ink-secondary">Only the MC&rsquo;s admins can open this page.</p>
        <Link href="/" className="mt-2 text-sm font-semibold text-apl-ink">
          Back to your dashboard
        </Link>
      </main>
    );
  }

  const current = await currentWindow();
  const [preview, roles, credits, scorable, eventsJob, config] = await Promise.all([
    importAssignments(currentUser.id, { dryRun: true }),
    // Only members this term can be credited -- never an EP, never a departed
    // officer (D-71) -- each with the role they share under (D-73).
    inTermRoles(),
    db.epAssignment.findMany({
      select: {
        epPersonId: true,
        memberId: true,
        fromExpa: true,
        fromSheet: true,
        fromAdmin: true,
        isMain: true,
        removedAt: true,
      },
    }),
    db.exchangeEvent.findMany({
      where: { occurredAt: { gte: current.startsAt, ...(current.endsAt ? { lte: current.endsAt } : {}) } },
      select: { epPersonId: true },
      distinct: ["epPersonId"],
    }),
    syncJobState("events"),
    db.scoreConfig.findFirst({ where: { isActive: true } }),
  ]);

  const scorableIds = scorable.map((row) => row.epPersonId);
  const expa = await expaEpDirectory({ floor: current.startsAt, alsoIds: scorableIds });

  // Everyone who can appear in a chip, the picker or the sheet's name list:
  // this term's members, the register's, anyone EXPA names who holds a member
  // row, and whoever a sheet name matches. Named from every member, not just
  // this term's, so a credit held by someone whose term ended still says who.
  const namedIds = new Set<string>([
    ...roles.keys(),
    ...credits.map((credit) => String(credit.memberId)),
    ...preview.names.flatMap((name) => (name.memberId ? [name.memberId] : [])),
  ]);
  for (const ep of expa.byEp.values()) {
    for (const manager of ep.managers ?? []) namedIds.add(String(manager.id));
  }
  const named = await db.member.findMany({
    where: { id: { in: [...namedIds].map(BigInt) } },
    select: { id: true, fullName: true },
  });
  const memberName = new Map(named.map((member) => [String(member.id), personName(member.fullName)]));
  // The saved character, so a member's portrait here is the one in the header (D-51).
  const avatars = await memberAvatars(named);
  const characterOf = (id: string) => avatars.get(BigInt(id))?.id ?? null;

  const creditsByEp = new Map<string, Credit[]>();
  for (const credit of credits) {
    const key = String(credit.epPersonId);
    const bucket = creditsByEp.get(key);
    if (bucket) bucket.push(credit);
    else creditsByEp.set(key, [credit]);
  }

  const roleShares = config ? readRoleShares(config.roleShares) : {};

  function managersFor(epPersonId: string, context: ExpaEp | undefined): ManagerChip[] {
    const held = creditsByEp.get(epPersonId) ?? [];
    const counting = held.filter((credit) => isActiveCredit(credit) && roles.has(String(credit.memberId)));
    const main = held.find((credit) => credit.isMain && credit.removedAt === null)?.memberId ?? null;
    const shares = creditShares(
      counting.map((credit) => ({ memberId: credit.memberId, role: roles.get(String(credit.memberId)) ?? null })),
      main,
      roleShares
    );
    // A lone manager with no pick takes everything, which needs no label.
    const showShares = counting.length > 1 || main !== null;

    const chips: ManagerChip[] = held
      .filter((credit) => credit.removedAt !== null || isActiveCredit(credit))
      .map((credit) => {
        const id = String(credit.memberId);
        const creditable = roles.has(id);
        return {
          memberId: id,
          fullName: memberName.get(id) ?? `Member ${id}`,
          characterId: characterOf(id),
          state: credit.removedAt ? "removed" : creditable ? "active" : "outside",
          isMain: credit.isMain && credit.removedAt === null,
          sources: sourcesOf(credit),
          share: showShares && creditable && !credit.removedAt ? (shares.get(id) ?? null) : null,
          role: roles.get(id) ?? null,
        };
      });

    // Managers EXPA names that the register does not hold yet: a member the
    // next sync will credit, or someone who is not a member and never will be.
    for (const manager of context?.managers ?? []) {
      const id = String(manager.id);
      if (held.some((credit) => String(credit.memberId) === id)) continue;
      const known = memberName.has(id);
      chips.push({
        memberId: id,
        fullName: memberName.get(id) ?? manager.fullName,
        characterId: known ? characterOf(id) : null,
        state: roles.has(id) ? "pending" : "outside",
        isMain: false,
        sources: ["EXPA"],
        share: null,
        role: roles.get(id) ?? null,
      });
    }

    const order: Record<ManagerChip["state"], number> = { active: 0, pending: 1, removed: 2, outside: 3 };
    return chips.sort(
      (a, b) =>
        Number(b.isMain) - Number(a.isMain) || order[a.state] - order[b.state] || a.fullName.localeCompare(b.fullName)
    );
  }

  // Everyone updated since the current window opened (D-76). An EP who scores
  // in the window is always among them -- a stage never postdates its
  // application's last action -- but they are added by id as well, so an EXPA
  // outage never hides someone who is earning points. The window's end is not
  // applied: GIS keeps only the latest update, so an EP updated inside the
  // window and again after it would otherwise vanish. A member who has never
  // applied is not an EP.
  const listedIds = new Set<string>(scorableIds.map(String));
  for (const [id, context] of expa.byEp) {
    if (context.isMemberNotEp) continue;
    if (context.lastActionAt && context.lastActionAt >= current.startsAt) listedIds.add(id);
  }

  const rows: AssignmentRow[] = [...listedIds]
    .filter((id) => !expa.byEp.get(id)?.isMemberNotEp)
    .map((epPersonId) => {
      const context = expa.byEp.get(epPersonId);
      return {
        epPersonId,
        context,
        fullName: context?.fullName ?? null,
        activityAt: context?.lastActionAt ?? null,
      };
    })
    .sort(byNewest)
    .map(({ epPersonId, context }) => ({
      epPersonId,
      fullName: context?.fullName ?? null,
      lastActionLabel: dateLabel("last action", context?.lastActionAt ?? null),
      signedUpLabel: dateLabel("signed up", context?.signedUpAt ?? null),
      products: context?.activeProgrammeIds ?? [],
      status: context?.status ?? null,
      managers: managersFor(epPersonId, context),
    }));

  const members = [...roles]
    .flatMap(([id, role]) => {
      const fullName = memberName.get(id);
      return fullName ? [{ id, fullName, role }] : [];
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const refreshed = eventsJob?.lastSucceededAt
    ? `Last refreshed ${timeAgo(eventsJob.lastSucceededAt)}`
    : "Not refreshed yet";

  const sheetNames = preview.names.map((name) => ({
    name: name.name,
    lc: name.lc,
    team: name.team,
    eps: name.eps,
    status: name.status,
    memberName: name.memberId ? (memberName.get(name.memberId) ?? null) : null,
    source: name.source,
    mappingId: name.mappingId,
  }));
  const memberOptions = members.map((member) => ({
    value: member.id,
    label: member.fullName,
    hint: member.role ?? undefined,
  }));

  return (
    <main className="page-end min-h-full shrink-0 bg-wall px-6 pt-8 sm:px-11">
      <div className="mb-7 flex items-center justify-end gap-4">
        <Link
          href="/"
          className="rounded-full bg-surface-raised px-4 py-2.5 text-[13px] font-medium text-ink-secondary shadow-e1 transition-colors hover:bg-surface-sunken"
        >
          Back to the dashboard
        </Link>
      </div>

      <Rise className="flex flex-col gap-7 rounded-[28px] bg-surface p-7 shadow-e3 sm:p-12">
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <h1 className="font-display text-[28px] font-semibold text-ink">Assignments</h1>
            <p className="mt-1.5 max-w-140 text-sm text-ink-secondary">
              Choose who earns points for each EP. Managers in EXPA and in the sign-up sheet are
              added for you, and you can add or remove anyone here. When several people share an
              EP, they split its points by role, as set in{" "}
              <Link href="/admin/scoring" className="font-semibold text-apl-ink">
                Scoring
              </Link>
              .
            </p>
          </div>

          <AdminNav active="assignments" />
        </header>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              {preview.sheetLabel ?? "Sign-up sheet"}
            </h2>
            <p className="max-w-120 text-[13px] text-ink-secondary">
              Each EP&rsquo;s manager is matched by name to the sheet&rsquo;s manager list. If a
              name isn&rsquo;t there, or belongs to more than one member, choose who it is below.
              The sheet is read again at every refresh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-7">
            <Figure value={preview.epsListed} label={preview.epsListed === 1 ? "EP in the sheet" : "EPs in the sheet"} />
            <Figure
              value={preview.epsMatched}
              label={preview.epsMatched === 1 ? "matched to a member" : "matched to members"}
            />
            <Figure value={preview.epsUnassigned} label="with no manager yet" tone="text-break-ink" />
            <div className="flex-1" />
            <ImportButtons />
          </div>

          {preview.issues.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {preview.issues.map((issue, index) => (
                <li key={index} className="flex items-start gap-2.5 rounded-xl bg-re-wash px-3.5 py-2.5">
                  <span aria-hidden className="mt-1.5 size-2 flex-none rounded-full bg-stage-re" />
                  <span className="text-[13px] leading-snug text-ink">
                    {issue.lineNumber ? <b>Line {issue.lineNumber}: </b> : null}
                    {issue.detail}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {preview.sheetRead ? <SheetNames names={sheetNames} members={memberOptions} /> : null}
        </section>

        <section className="flex flex-col gap-3.5 rounded-[22px] bg-surface-raised px-7 py-6.5">
          {expa.ok ? null : (
            <p className="flex items-center gap-2.5 rounded-xl bg-re-wash px-3.5 py-2.5 text-[13px] font-semibold text-ink">
              <span aria-hidden className="size-2 flex-none rounded-full bg-stage-re" />
              EXPA isn&rsquo;t responding, so some names, statuses, products and managers may be
              missing. Reload the page to try again.
            </p>
          )}
          <AssignmentsTable
            rows={rows}
            members={members}
            refreshed={refreshed}
            since={formatDisplay(toIso(current.startsAt))}
          />
        </section>
      </Rise>
    </main>
  );
}

function Figure({ value, label, tone = "text-ink" }: { value: number; label: string; tone?: string }) {
  return (
    <p className={`text-sm ${tone === "text-ink" ? "text-ink-secondary" : tone}`}>
      <span className={`tabular text-[22px] font-bold ${tone}`}>{value}</span> {label}
    </p>
  );
}

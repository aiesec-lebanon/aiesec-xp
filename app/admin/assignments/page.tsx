import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { expaEpContext } from "@/lib/gis/expa-ep-context";
import { importAssignments } from "@/lib/import/run-import";
import { epFunnelStatus } from "@/lib/scoring/engine";

import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { AliasForm, ImportButtons } from "./controls";
import { AssignmentsTable, type AssignmentRow } from "./assignments-table";

export const dynamic = "force-dynamic";

export default async function AssignmentsAdminPage() {
  const currentUser = await requireMemberPage("/admin/assignments");

  if (currentUser.role !== "ADMIN") {
    return (
      <main className="flex min-h-full shrink-0 flex-col items-center justify-center gap-3 bg-wall px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Not available</h1>
        <p className="text-sm text-ink-secondary">This console is for MCP and MCVP IM.</p>
        <Link href="/" className="mt-2 text-sm font-semibold text-apl-ink">
          Back to your dashboard
        </Link>
      </main>
    );
  }

  const [preview, members, aliases, assignments, epEvents, epContext] = await Promise.all([
    importAssignments(currentUser.id, { dryRun: true }),
    db.member.findMany({
      where: { positions: { some: {} } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    db.managerAlias.findMany(),
    db.epAssignment.findMany(),
    db.exchangeEvent.findMany({
      select: {
        epPersonId: true,
        programmeId: true,
        applicationId: true,
        eventType: true,
        occurredAt: true,
      },
    }),
    expaEpContext(),
  ]);

  const memberName = new Map(members.map((member) => [String(member.id), member.fullName]));
  const assignedBy = new Map(assignments.map((entry) => [String(entry.epPersonId), entry]));
  const memberOptions = members.map((member) => ({
    id: String(member.id),
    fullName: member.fullName,
  }));

  const eventsByEp = new Map<string, typeof epEvents>();
  for (const event of epEvents) {
    const key = String(event.epPersonId);
    const bucket = eventsByEp.get(key);
    if (bucket) bucket.push(event);
    else eventsByEp.set(key, [event]);
  }

  // Named EPs first and alphabetical within them: an admin works down this list
  // looking for a person, and an id alone is nothing to look for.
  const rows: AssignmentRow[] = [...eventsByEp.entries()]
    .map(([epPersonId, events]) => {
      const assignment = assignedBy.get(epPersonId);
      const expa = epContext.get(epPersonId)?.managers ?? [];

      return {
        epPersonId,
        fullName: epContext.get(epPersonId)?.fullName ?? null,
        products: [...new Set(events.map((event) => event.programmeId))].sort((a, b) => a - b),
        status: epFunnelStatus(events),
        creditedMemberId: assignment ? String(assignment.memberId) : null,
        creditedName: assignment
          ? (memberName.get(String(assignment.memberId)) ?? String(assignment.memberId))
          : null,
        source: assignment?.source ?? null,
        expaManagers: expa.map((manager) => ({ id: String(manager.id), fullName: manager.fullName })),
      };
    })
    .sort((a, b) => {
      if (a.fullName && b.fullName) return a.fullName.localeCompare(b.fullName);
      if (a.fullName) return -1;
      if (b.fullName) return 1;
      return a.epPersonId.localeCompare(b.epPersonId);
    });

  const managerOptions = [...new Map(rows.flatMap((row) => row.expaManagers).map((m) => [m.id, m.fullName]))]
    .map(([id, fullName]) => ({ id, fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

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
              Imported from the MC&rsquo;s sheets. Assignment is decided there — this is where it is
              read, and corrected when it is wrong.
            </p>
          </div>

          <AdminNav active="assignments" />
        </header>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Import</h2>
          </div>

          <div className="flex flex-wrap items-center gap-7">
            <Figure value={preview.sheetsRead} label={preview.sheetsRead === 1 ? "sheet read" : "sheets read"} />
            <Figure value={preview.rowsRead} label="rows" />
            <Figure value={preview.rowsSkipped} label="skipped" tone="text-break-ink" />
            <Figure
              value={preview.unmappedLabels.length}
              label={preview.unmappedLabels.length === 1 ? "unmapped label" : "unmapped labels"}
              tone="text-re-ink"
            />
            <div className="flex-1" />
            <ImportButtons />
          </div>

          {preview.issues.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {preview.issues.map((issue, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2.5 rounded-xl bg-re-wash px-3.5 py-2.5"
                >
                  <span aria-hidden className="mt-1.5 size-2 flex-none rounded-full bg-stage-re" />
                  <span className="text-[13px] leading-snug text-ink">
                    <b>{issue.sheet}</b>
                    {issue.lineNumber ? `, line ${issue.lineNumber}` : ""}: {issue.detail}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2.5 rounded-xl bg-apd-wash px-3.5 py-2.5 text-[13px] font-semibold text-ink">
              <span aria-hidden className="size-2 flex-none rounded-full bg-stage-apd" />
              Every readable row parses. Nothing to correct before import.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-4.5 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              Manager names
            </h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              The sheets name a manager by first name. Map each once — rows using an unmapped name
              don&rsquo;t score.
            </p>
          </div>

          {preview.unmappedLabels.length === 0 ? (
            <p className="rounded-2xl bg-apd-wash px-5 py-4 text-sm font-semibold text-ink">
              Every name in the sheets is mapped.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {preview.unmappedLabels.map((entry) => (
                <li
                  key={entry.label}
                  className={`rounded-2xl px-5 py-4 ${
                    entry.suggestions.length === 0 ? "bg-break-wash" : "bg-surface"
                  }`}
                >
                  <AliasForm
                    label={entry.label}
                    rowCount={entry.rowCount}
                    suggestions={entry.suggestions.map((suggestion) => ({
                      memberId: String(suggestion.member.id),
                      fullName: suggestion.member.fullName,
                      reason: suggestion.reason,
                    }))}
                    members={memberOptions}
                  />
                </li>
              ))}
            </ul>
          )}

          {aliases.length > 0 ? (
            <details className="text-[13px] text-ink-secondary">
              <summary className="cursor-pointer font-semibold text-ink">
                Mapped names ({aliases.length})
              </summary>
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {aliases.map((alias) => (
                  <li key={alias.label}>
                    <code className="font-mono text-xs text-ink">{alias.label}</code>
                    {" = "}
                    {memberName.get(String(alias.memberId)) ?? "unknown member"}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="flex flex-col gap-3.5 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <AssignmentsTable rows={rows} members={memberOptions} managers={managerOptions} />
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

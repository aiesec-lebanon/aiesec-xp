import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { expaManagersByEp } from "@/lib/gis/expa-managers";
import { importAssignments } from "@/lib/import/run-import";
import { AliasForm, ImportButtons, OverrideForm } from "./controls";

export const dynamic = "force-dynamic";

export default async function AssignmentsAdminPage() {
  const user = await requireMemberPage("/admin/assignments");
  if (user.role !== "ADMIN") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold">Not available</h1>
        <p className="mt-2 text-sm text-neutral-600">This page is for MCP and MCVP IM.</p>
      </main>
    );
  }

  const [preview, members, aliases, assignments, eps, expaManagers] = await Promise.all([
    importAssignments(user.id, { dryRun: true }),
    db.member.findMany({
      where: { positions: { some: {} } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    db.managerAlias.findMany(),
    db.epAssignment.findMany(),
    db.exchangeEvent.findMany({ select: { epPersonId: true }, distinct: ["epPersonId"] }),
    expaManagersByEp(),
  ]);

  const memberName = new Map(members.map((m) => [String(m.id), m.fullName]));
  const aliasByLabel = new Map(aliases.map((a) => [a.label, a.memberId]));
  const assignedBy = new Map(assignments.map((a) => [String(a.epPersonId), a]));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Assignments</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Imported from the MC&apos;s sheets. Assignment is decided there; this is where it is read,
          and corrected when it is wrong.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Import</h2>
        <p className="text-sm">
          {preview.sheetsRead} sheet(s) readable, {preview.rowsRead} rows,{" "}
          {preview.rowsSkipped} skipped, {preview.unmappedLabels.length} unmapped label(s).
        </p>
        <ImportButtons />
        {preview.issues.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm text-amber-800">
            {preview.issues.map((issue, index) => (
              <li key={index}>
                <strong>{issue.sheet}</strong>
                {issue.lineNumber ? ` line ${issue.lineNumber}` : ""}: {issue.detail}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Manager names
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          The sheets name a manager by first name. Map each one to a member once; rows using an
          unmapped name do not score.
        </p>

        {preview.unmappedLabels.length === 0 ? (
          <p className="text-sm">Every name in the sheets is mapped.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {preview.unmappedLabels.map((entry) => (
              <li key={entry.label} className="border-t pt-3">
                <AliasForm
                  label={entry.label}
                  rowCount={entry.rowCount}
                  suggestions={entry.suggestions.map((s) => ({
                    memberId: String(s.member.id),
                    fullName: s.member.fullName,
                    reason: s.reason,
                  }))}
                  members={members.map((m) => ({ id: String(m.id), fullName: m.fullName }))}
                />
              </li>
            ))}
          </ul>
        )}

        {aliases.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer">Mapped names ({aliases.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {aliases.map((alias) => (
                <li key={alias.label}>
                  <code>{alias.label}</code> = {memberName.get(String(alias.memberId)) ?? "unknown"}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          EPs with scored events ({eps.length})
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-2">EP</th>
              <th>Credited to</th>
              <th>Source</th>
              <th>Manager in EXPA</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {eps.map(({ epPersonId }) => {
              const key = String(epPersonId);
              const assignment = assignedBy.get(key);
              const expa = expaManagers.get(key) ?? [];
              return (
                <tr key={key} className="border-t align-top">
                  <td className="py-2">{key}</td>
                  <td>
                    {assignment
                      ? (memberName.get(String(assignment.memberId)) ?? String(assignment.memberId))
                      : <span className="text-amber-800">Unattributed</span>}
                  </td>
                  <td className="text-neutral-500">{assignment?.source ?? "-"}</td>
                  <td className="text-neutral-500">
                    {expa.length > 0 ? expa.map((m) => m.fullName).join(", ") : "-"}
                  </td>
                  <td>
                    <OverrideForm
                      epPersonId={key}
                      members={members.map((m) => ({ id: String(m.id), fullName: m.fullName }))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {aliasByLabel.size === 0 ? null : null}
      </section>
    </main>
  );
}

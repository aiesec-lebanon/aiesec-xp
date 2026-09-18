import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { expaEpContext } from "@/lib/gis/expa-ep-context";
import { importAssignments } from "@/lib/import/run-import";

import { CharacterAvatar } from "@/components/studio/character";
import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { AliasForm, ImportButtons, OverrideForm } from "./controls";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

// D-04: the products in scope.
const PROGRAMMES: Record<number, string> = { 7: "GV", 8: "GTa", 9: "GTe" };

export default async function AssignmentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireMemberPage("/admin/assignments");

  if (user.role !== "ADMIN") {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-3 bg-wall px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Not available</h1>
        <p className="text-sm text-ink-secondary">This console is for MCP and MCVP IM.</p>
        <Link href="/" className="mt-2 text-sm font-semibold text-apl-ink">
          Back to your dashboard
        </Link>
      </main>
    );
  }

  const params = await searchParams;

  const [preview, members, aliases, assignments, epEvents, epContext] = await Promise.all([
    importAssignments(user.id, { dryRun: true }),
    db.member.findMany({
      where: { positions: { some: {} } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    db.managerAlias.findMany(),
    db.epAssignment.findMany(),
    db.exchangeEvent.groupBy({ by: ["epPersonId", "programmeId"] }),
    expaEpContext(),
  ]);

  const memberName = new Map(members.map((member) => [String(member.id), member.fullName]));
  const assignedBy = new Map(assignments.map((entry) => [String(entry.epPersonId), entry]));
  const memberOptions = members.map((member) => ({
    id: String(member.id),
    fullName: member.fullName,
  }));

  const productsByEp = new Map<string, number[]>();
  for (const { epPersonId, programmeId } of epEvents) {
    const key = String(epPersonId);
    const existing = productsByEp.get(key);
    if (existing) existing.push(programmeId);
    else productsByEp.set(key, [programmeId]);
  }

  // Named EPs first and alphabetical within them: an admin works down this list
  // looking for a person, and an id alone is nothing to look for.
  const eps = [...productsByEp.keys()]
    .map((epPersonId) => ({
      epPersonId,
      fullName: epContext.get(epPersonId)?.fullName ?? null,
      products: [...new Set(productsByEp.get(epPersonId) ?? [])].sort((a, b) => a - b),
    }))
    .sort((a, b) => {
      if (a.fullName && b.fullName) return a.fullName.localeCompare(b.fullName);
      if (a.fullName) return -1;
      if (b.fullName) return 1;
      return a.epPersonId.localeCompare(b.epPersonId);
    });

  const pageCount = Math.max(1, Math.ceil(eps.length / PER_PAGE));
  const page = Math.min(
    pageCount,
    Math.max(1, params.page && /^\d+$/.test(params.page) ? Number(params.page) : 1)
  );
  const shown = eps.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <main className="min-h-full bg-wall px-6 py-8 sm:px-11">
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
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              EPs with scored events ({eps.length})
            </h2>
            <span className="font-mono text-[11px] text-ink-faint">
              Page {page} of {pageCount}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="grid grid-cols-[1fr_1fr] gap-4 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint xl:grid-cols-[minmax(200px,1.2fr)_1fr_130px_200px_220px]">
              <span>EP</span>
              <span>Credited to</span>
              <span className="hidden xl:block">Source</span>
              <span className="hidden xl:block">Manager in EXPA</span>
              <span className="hidden xl:block">Change</span>
            </div>

            {shown.map(({ epPersonId: key, fullName, products }) => {
              const assignment = assignedBy.get(key);
              const credited = assignment
                ? (memberName.get(String(assignment.memberId)) ?? String(assignment.memberId))
                : null;
              const expa = epContext.get(key)?.managers ?? [];

              return (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_1fr] items-center gap-4 rounded-2xl px-3.5 py-3 transition-colors hover:bg-surface xl:grid-cols-[minmax(200px,1.2fr)_1fr_130px_200px_220px]"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-semibold text-ink">
                      {fullName ?? <span className="text-ink-faint">Name not in EXPA</span>}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="tabular font-mono text-[11px] text-ink-faint">{key}</span>
                      {products.map((programmeId) => (
                        <span
                          key={programmeId}
                          className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] text-ink-secondary"
                        >
                          {PROGRAMMES[programmeId] ?? `Programme ${programmeId}`}
                        </span>
                      ))}
                    </span>
                  </span>

                  <span className="flex items-center gap-2.5">
                    {credited ? (
                      <CharacterAvatar name={credited} size={32} rounded="rounded-[11px]" />
                    ) : null}
                    <span
                      className={`text-sm font-semibold ${
                        credited ? "text-ink" : "text-break-ink"
                      }`}
                    >
                      {credited ?? "Unattributed"}
                    </span>
                  </span>

                  <span className="hidden xl:block">
                    <SourceTag source={assignment?.source ?? null} />
                  </span>

                  <span className="hidden text-[13px] text-ink-secondary xl:block">
                    {expa.length > 0 ? expa.map((manager) => manager.fullName).join(", ") : "—"}
                  </span>

                  <span className="col-span-2 xl:col-span-1">
                    <OverrideForm epPersonId={key} members={memberOptions} />
                  </span>
                </div>
              );
            })}

            {eps.length === 0 ? (
              <p className="px-3.5 py-6 text-[13px] text-ink-secondary">
                No EP has a scored event yet, so there is nothing to attribute.
              </p>
            ) : null}
          </div>

          {pageCount > 1 ? (
            <div className="flex items-center justify-end gap-2 pt-1">
              <PageLink href={`/admin/assignments?page=${page - 1}`} disabled={page === 1}>
                Prev
              </PageLink>
              <PageLink
                href={`/admin/assignments?page=${page + 1}`}
                disabled={page === pageCount}
              >
                Next
              </PageLink>
            </div>
          ) : null}
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

function SourceTag({ source }: { source: string | null }) {
  if (!source) {
    return <span className="text-[13px] text-ink-faint">—</span>;
  }

  // An ADMIN correction survives re-import (D-45), so it is the one source a
  // reader has to be able to pick out of a column at a glance.
  const admin = source === "ADMIN";

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold tracking-[0.05em] ${
        admin ? "bg-apl-wash text-apl-ink" : "bg-surface-sunken text-ink-secondary"
      }`}
    >
      {source}
    </span>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className =
    "rounded-[9px] border border-line bg-surface-raised px-4 py-1.5 text-xs font-semibold text-ink";

  if (disabled) {
    return (
      <span aria-disabled className={`${className} opacity-40`}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={`${className} transition-colors hover:bg-surface-sunken`}>
      {children}
    </Link>
  );
}

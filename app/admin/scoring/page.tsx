import Link from "next/link";

import { ROLE_SENIORITY } from "@/lib/auth/roles";
import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDisplay, toIso } from "@/lib/design/calendar";
import { inTermRoles } from "@/lib/org/members";
import { readRoleShares } from "@/lib/scoring/config";

import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { WeightsForm, type RoleRow } from "./controls";

export const dynamic = "force-dynamic";
// Saving replays the ledger, which runs under this page's limit.
export const maxDuration = 300;

function seniority(role: string): number {
  const index = ROLE_SENIORITY.indexOf(role);
  return index === -1 ? ROLE_SENIORITY.length : index;
}

export default async function ScoringAdminPage() {
  const user = await requireMemberPage("/admin/scoring");

  if (user.role !== "ADMIN") {
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

  const [window, roles] = await Promise.all([
    db.displayWindow.findFirst({ where: { isActive: true }, include: { config: true } }),
    inTermRoles(),
  ]);
  const config = window?.config ?? null;

  const shares = config ? readRoleShares(config.roleShares) : {};
  const held = new Map<string, number>();
  for (const role of roles.values()) {
    if (role) held.set(role, (held.get(role) ?? 0) + 1);
  }

  // Every role someone holds this term, and any role that already has a share.
  const rows: RoleRow[] = [...new Set([...held.keys(), ...Object.keys(shares)])]
    .sort((a, b) => seniority(a) - seniority(b) || a.localeCompare(b))
    .map((role) => ({ role, members: held.get(role) ?? 0, share: shares[role] ?? 0 }));

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
            <h1 className="font-display text-[28px] font-semibold text-ink">Scoring</h1>
            <p className="mt-1.5 max-w-140 text-sm text-ink-secondary">
              Decide what each stage is worth and what each manager earns when more than one
              member works on an EP. These apply to the current scoring period only: when you
              save, its points are recalculated, and earlier periods keep the points they had.
            </p>
          </div>

          <AdminNav active="scoring" />
        </header>

        {window && config ? (
          <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {window.label}{" "}
                <span className="font-normal text-ink-secondary">
                  {formatDisplay(toIso(window.startsAt))}
                  {window.endsAt ? ` to ${formatDisplay(toIso(window.endsAt))}` : " onwards"}
                </span>
              </h2>
              <p className="mt-1 text-[13px] text-ink-secondary">
                Each stage counts in the scoring period it happened in. For example, an EP who
                applied before the period and was approved during it earns the approval only. A
                break takes back what its stage paid, whatever the points are now.
              </p>
              <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
                How shares work
              </h3>
              <ul className="mt-2 flex max-w-160 list-disc flex-col gap-1 pl-5 text-[13px] text-ink-secondary">
                <li>
                  The EP&rsquo;s main manager, picked on{" "}
                  <Link href="/admin/assignments" className="font-semibold text-apl-ink">
                    Assignments
                  </Link>
                  , gets all of its points and counts each APL, APD and RE as 1.
                </li>
                <li>
                  Everyone else on the EP gets their role&rsquo;s percentage of the points, and counts
                  that part of the stage (15% counts as 0.15). Two people in the same role each get
                  the full percentage.
                </li>
                <li>
                  With no main picked, everyone gets their role&rsquo;s percentage. A manager alone on
                  an EP always gets everything.
                </li>
                <li>Each member counts under their most senior position this term. A role left at 0% gets nothing.</li>
              </ul>
            </div>

            <WeightsForm
              roles={rows}
              weights={{
                aplPoints: Number(config.aplPoints),
                apdPoints: Number(config.apdPoints),
                rePoints: Number(config.rePoints),
                productWeights: config.productWeights as Record<string, number>,
                directionWeights: config.directionWeights as Record<string, number>,
              }}
            />
          </section>
        ) : (
          <p className="rounded-2xl bg-break-wash px-5 py-4 text-sm font-semibold text-ink">
            There&rsquo;s no scoring period with points set up yet, so there&rsquo;s nothing to change. Let whoever looks after the platform know.
          </p>
        )}
      </Rise>
    </main>
  );
}

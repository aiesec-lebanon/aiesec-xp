import Link from "next/link";

import { ROLE_SENIORITY } from "@/lib/auth/roles";
import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { inTermRoles } from "@/lib/org/members";
import { readRoleShares } from "@/lib/scoring/config";

import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { RoleSharesForm, type RoleRow } from "./controls";

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

  const [config, roles] = await Promise.all([
    db.scoreConfig.findFirst({ where: { isActive: true } }),
    inTermRoles(),
  ]);

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
              Decide how an EP&rsquo;s points are split when more than one member works on it.
              When you save, everyone&rsquo;s points are recalculated.
            </p>
          </div>

          <AdminNav active="scoring" />
        </header>

        {config ? (
          <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
                Shares by role
              </h2>
              <ul className="mt-2 flex max-w-160 list-disc flex-col gap-1 pl-5 text-[13px] text-ink-secondary">
                <li>A member who works on an EP alone gets all of its points, whatever their role.</li>
                <li>
                  When several people share an EP, each role gets its share. Shares are scaled so
                  the EP&rsquo;s points are always paid out in full. People in the same role split
                  that role&rsquo;s share equally.
                </li>
                <li>
                  Each member counts under their most senior position this term. Only points are
                  split: everyone on the EP still gets the APL, APD or RE on their count.
                </li>
              </ul>
            </div>

            <RoleSharesForm roles={rows} />
          </section>
        ) : (
          <p className="rounded-2xl bg-break-wash px-5 py-4 text-sm font-semibold text-ink">
            Points aren&rsquo;t set up yet, so there&rsquo;s nothing to split. Let whoever looks after the platform know.
          </p>
        )}

        {config ? (
          <section className="flex flex-wrap items-center gap-7 rounded-[22px] bg-surface-raised px-7 py-6.5">
            <h2 className="w-full text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              Points per stage
            </h2>
            <Points label="Application" value={Number(config.aplPoints)} tone="text-stage-apl" />
            <Points label="Approval" value={Number(config.apdPoints)} tone="text-stage-apd" />
            <Points label="Realization" value={Number(config.rePoints)} tone="text-stage-re" />
            <p className="w-full text-[13px] text-ink-secondary">
              Each stage counts in the scoring period it happened in. For example, an EP who
              applied before the period and was approved during it earns the approval only.
            </p>
          </section>
        ) : null}
      </Rise>
    </main>
  );
}

function Points({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <p className="text-sm text-ink-secondary">
      <span className={`tabular text-[22px] font-bold ${tone}`}>{value}</span> {label}
    </p>
  );
}

import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { toDateInputValue } from "@/lib/admin/window";
import { activeWindowOrDefault } from "@/lib/admin/window-form";
import { fetchFunnelAnalytics, type ProductFunnelCounts } from "@/lib/analytics/aiesec-analytics";
import { PROGRAMME_IDS } from "@/lib/analytics/funnel-tags";
import { mcOfficeId } from "@/lib/env";
import { activeMemberCount } from "@/lib/org/active-members";
import { termStart } from "@/lib/term";

import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { TermForm, WindowForm } from "./controls";

export const dynamic = "force-dynamic";

const PROGRAMME_LABEL: Record<number, string> = { 7: "GV", 8: "GTa", 9: "GTe" };

export default async function WindowAdminPage() {
  const user = await requireMemberPage("/admin/window");

  if (user.role !== "ADMIN") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-wall px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Not available</h1>
        <p className="text-sm text-ink-secondary">This console is for MCP and MCVP IM.</p>
        <Link href="/" className="mt-2 text-sm font-semibold text-apl-ink">
          Back to your dashboard
        </Link>
      </main>
    );
  }

  const officeId = mcOfficeId();
  const form = await activeWindowOrDefault();

  const [analytics, memberCount, term] = await Promise.all([
    fetchFunnelAnalytics({
      officeId: Number(officeId),
      startDate: form.startsAt,
      endDate: form.endsAt || toDateInputValue(new Date()),
      programmeIds: PROGRAMME_IDS,
    }),
    activeMemberCount(officeId),
    termStart(),
  ]);

  return (
    <main className="min-h-dvh bg-wall px-6 py-8 sm:px-11">
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
            <h1 className="font-display text-[28px] font-semibold text-ink">Display window</h1>
            <p className="mt-1.5 max-w-140 text-sm text-ink-secondary">
              The date range everyone is measured in (D-07). Saving replays every score and reward
              grant against the new bounds.
            </p>
          </div>

          <AdminNav active="window" />
        </header>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              Current window
            </h2>
            {form.isDefault ? (
              <span className="rounded-full bg-apl-wash px-3 py-1 text-[11px] font-bold tracking-[0.05em] text-apl-ink">
                No window set — showing this month
              </span>
            ) : null}
          </div>

          <WindowForm label={form.label} startsAt={form.startsAt} endsAt={form.endsAt} />
        </section>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              Term start
            </h2>
            <p className="mt-1 max-w-140 text-[13px] text-ink-secondary">
              The floor under everything (D-58). Sync collects nothing earlier, and the leaderboards
              open on this date through today when nobody has picked a range. Moving it does not
              replay the ledger — the window above is what scores are measured in.
            </p>
          </div>

          <TermForm startsAt={toDateInputValue(term)} />
        </section>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              AIESEC analytics, entity {String(officeId)}
            </h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              Live totals from AIESEC&rsquo;s own analytics API for the dates above — a sanity check
              against the ledger, not what scores it.
            </p>
          </div>

          {analytics ? (
            <FunnelTable analytics={analytics} />
          ) : (
            <p className="rounded-2xl bg-break-wash px-5 py-4 text-sm font-semibold text-ink">
              Could not reach the AIESEC analytics API just now. The window can still be saved.
            </p>
          )}

          <p className="text-[13px] text-ink-secondary">
            <span className="tabular font-bold text-ink">
              {memberCount === null ? "—" : memberCount}
            </span>{" "}
            member{memberCount === 1 ? "" : "s"} with an active role in entity {String(officeId)}.
          </p>
        </section>
      </Rise>
    </main>
  );
}

function FunnelTable({ analytics }: { analytics: ProductFunnelCounts }) {
  const totals = { APL: 0, APD: 0, RE: 0 };
  for (const counts of Object.values(analytics)) {
    totals.APL += counts.APL;
    totals.APD += counts.APD;
    totals.RE += counts.RE;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[80px_1fr_1fr_1fr] gap-4 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        <span>Product</span>
        <span>APL</span>
        <span>APD</span>
        <span>RE</span>
      </div>

      {PROGRAMME_IDS.map((programmeId) => {
        const counts = analytics[programmeId] ?? { APL: 0, APD: 0, RE: 0 };
        return (
          <div
            key={programmeId}
            className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-4 rounded-2xl px-3.5 py-2.5"
          >
            <span className="text-sm font-semibold text-ink">{PROGRAMME_LABEL[programmeId]}</span>
            <span className="tabular text-sm text-stage-apl">{counts.APL}</span>
            <span className="tabular text-sm text-stage-apd">{counts.APD}</span>
            <span className="tabular text-sm text-stage-re">{counts.RE}</span>
          </div>
        );
      })}

      <div className="grid grid-cols-[80px_1fr_1fr_1fr] items-center gap-4 rounded-2xl bg-surface px-3.5 py-2.5">
        <span className="text-sm font-bold text-ink">Total</span>
        <span className="tabular text-sm font-bold text-stage-apl">{totals.APL}</span>
        <span className="tabular text-sm font-bold text-stage-apd">{totals.APD}</span>
        <span className="tabular text-sm font-bold text-stage-re">{totals.RE}</span>
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import type { SyncJob, SyncTrigger } from "@prisma/client";

import { requireMemberPage } from "@/lib/auth/guards";
import { formatOfficeTime, timeAgo } from "@/lib/design/time-labels";
import { isHackathonOn, isOverdue, type SyncJobName } from "@/lib/sync/cadence";
import { hackathonUntil, syncJobState } from "@/lib/sync/jobs";

import { Rise } from "@/components/studio/motion";

import { AdminNav } from "../admin-nav";
import { RunJobButton } from "../run-job-button";
import { HackathonSwitch } from "./controls";

export const dynamic = "force-dynamic";
// The run-now buttons are server actions, which run under this page's limit.
export const maxDuration = 300;

type JobStatus = "never" | "running" | "interrupted" | "succeeded" | "failed";

const STATUS: Record<JobStatus, { label: string; tone: string }> = {
  never: { label: "Never run", tone: "bg-surface-sunken text-ink-secondary" },
  running: { label: "Running", tone: "bg-apl-wash text-apl-ink" },
  interrupted: { label: "Interrupted", tone: "bg-re-wash text-re-ink" },
  succeeded: { label: "Succeeded", tone: "bg-apd-wash text-apd-ink" },
  failed: { label: "Failed", tone: "bg-break-wash text-break-ink" },
};

const TRIGGER_LABEL: Record<SyncTrigger, string> = {
  HACKATHON: "the hackathon tick",
  SCHEDULE: "the schedule",
  MANUAL: "an admin",
};

const CHIP = "rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.05em]";

function jobStatus(state: SyncJob | null, now: Date): JobStatus {
  if (!state?.lastStatus) return "never";
  if (state.lastStatus === "RUNNING") {
    // A run the platform killed never records its outcome; its lease lapsing
    // is how that shows.
    return state.leaseUntil && state.leaseUntil > now ? "running" : "interrupted";
  }
  return state.lastStatus === "SUCCESS" ? "succeeded" : "failed";
}

export default async function SyncAdminPage() {
  const user = await requireMemberPage("/admin/sync");

  if (user.role !== "ADMIN") {
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

  const now = new Date();
  const [until, events, roster] = await Promise.all([
    hackathonUntil(),
    syncJobState("events"),
    syncJobState("roster"),
  ]);
  const hackathon = isHackathonOn(until, now);

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
            <h1 className="font-display text-[28px] font-semibold text-ink">Sync</h1>
            <p className="mt-1.5 max-w-140 text-sm text-ink-secondary">
              When this product reads GIS (D-66). The schedules run on GitHub Actions; every button
              here runs the same job straight away.
            </p>
          </div>

          <AdminNav active="sync" />
        </header>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              Hackathon mode
            </h2>
            <span
              className={`${CHIP} ${
                hackathon ? "bg-apd-wash text-apd-ink" : "bg-surface-sunken text-ink-secondary"
              }`}
            >
              {hackathon && until ? `On until ${formatOfficeTime(until)}` : "Off"}
            </span>
          </div>

          <p className="max-w-160 text-[13px] text-ink-secondary">
            {hackathon && until
              ? `EP data refreshes every 5 minutes until ${formatOfficeTime(until)}, Beirut time, then drops back to once a day by itself.`
              : "EP data refreshes once a day. Switch this on for a hackathon and it refreshes every 5 minutes, then drops back to daily by itself when the time is up."}
          </p>

          <HackathonSwitch on={hackathon} />
        </section>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Jobs</h2>

          <ul className="flex flex-col gap-3">
            <JobRow
              job="events"
              title="EP data"
              description="Applications, approvals and realizations from GIS, then every score rebuilt from them."
              schedule={hackathon ? "Every 5 minutes (hackathon mode)" : "Daily, overnight"}
              button="Refresh now"
              pending="Refreshing…"
              state={events}
              now={now}
            />
            <JobRow
              job="roster"
              title="Members"
              description="Who holds an active position in each operating office, and the office tree itself."
              schedule="Monthly, on the 1st"
              button="Sync now"
              pending="Syncing…"
              state={roster}
              now={now}
            />
            <li className="flex flex-col gap-1.5 rounded-2xl bg-surface px-5 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-semibold text-ink">LC numbers</h3>
                <span className={`${CHIP} bg-apd-wash text-apd-ink`}>Live</span>
              </div>
              <p className="text-[13px] text-ink-secondary">
                Read from AIESEC&rsquo;s analytics API every time an LC board renders, and every
                minute on the TV screen (D-56). Nothing to schedule, so nothing to refresh.
              </p>
            </li>
          </ul>

          <p className="max-w-160 text-xs text-ink-muted">
            GitHub pauses scheduled workflows after 60 days without a commit to the repository. If a
            job falls behind, re-enable its workflow from the repository&rsquo;s Actions tab.
          </p>
        </section>
      </Rise>
    </main>
  );
}

function JobRow({
  job,
  title,
  description,
  schedule,
  button,
  pending,
  state,
  now,
}: {
  job: SyncJobName;
  title: string;
  description: string;
  schedule: string;
  button: string;
  pending: string;
  state: SyncJob | null;
  now: Date;
}) {
  const status = jobStatus(state, now);
  const behind = status !== "running" && isOverdue(job, state?.lastSucceededAt ?? null, now);

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
      <div className="flex min-w-60 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <span className={`${CHIP} ${STATUS[status].tone}`}>{STATUS[status].label}</span>
        </div>
        <p className="text-[13px] text-ink-secondary">{description}</p>

        <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <Fact term="Schedule">{schedule}</Fact>
          <Fact term="Last success">
            {state?.lastSucceededAt
              ? `${timeAgo(state.lastSucceededAt, now)} (${formatOfficeTime(state.lastSucceededAt)})`
              : "never"}
          </Fact>
          {state?.lastStartedAt && state.lastTrigger ? (
            <Fact term="Last run">
              {`${timeAgo(state.lastStartedAt, now)}, started by ${TRIGGER_LABEL[state.lastTrigger]}`}
            </Fact>
          ) : null}
        </dl>

        {status === "failed" && state?.lastError ? (
          <p className="mt-1 rounded-xl bg-break-wash px-3.5 py-2 font-mono text-xs text-break-ink">
            {state.lastError}
          </p>
        ) : null}

        {behind ? (
          <p className="mt-1 rounded-xl bg-re-wash px-3.5 py-2 text-[13px] text-ink">
            {state?.lastSucceededAt
              ? "Behind schedule. Run it now, and check its workflow in the repository's Actions tab."
              : "No successful run yet. Run it now, and check its workflow is set up in the repository's Actions tab."}
          </p>
        ) : null}
      </div>

      <RunJobButton job={job} label={button} pendingLabel={pending} />
    </li>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="font-semibold text-ink">{children}</dd>
    </div>
  );
}

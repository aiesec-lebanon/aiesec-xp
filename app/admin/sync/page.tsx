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
  never: { label: "Not run yet", tone: "bg-surface-sunken text-ink-secondary" },
  running: { label: "Refreshing", tone: "bg-apl-wash text-apl-ink" },
  interrupted: { label: "Didn't finish", tone: "bg-re-wash text-re-ink" },
  succeeded: { label: "Up to date", tone: "bg-apd-wash text-apd-ink" },
  failed: { label: "Didn't finish", tone: "bg-break-wash text-break-ink" },
};

const TRIGGER_LABEL: Record<SyncTrigger, string> = {
  HACKATHON: "automatically (hackathon mode)",
  SCHEDULE: "automatically",
  MANUAL: "by an admin",
};

// A failed run stores which steps failed, as "step: detail; step: detail". The
// detail is for whoever maintains the platform and stays in the logs; an admin
// is told which part of the refresh stopped.
const STEP_LABEL: Record<string, string> = {
  applications: "reading applications from EXPA",
  managers: "reading EP managers from EXPA",
  sheets: "reading the sign-up sheet",
  replay: "recalculating points",
  offices: "reading the list of LCs",
  roster: "reading member positions from EXPA",
};

function failedSteps(lastError: string): string {
  const steps = [...new Set(lastError.split("; ").map((part) => STEP_LABEL[part.split(":")[0]!.trim()]))];
  const known = steps.filter((step): step is string => step !== undefined);
  if (known.length === 0 || known.length !== steps.length) return "The last refresh didn't finish.";
  return `The last refresh stopped while ${known.join(" and ")}.`;
}

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
        <p className="text-sm text-ink-secondary">Only the MC&rsquo;s admins can open this page.</p>
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
            <h1 className="font-display text-[28px] font-semibold text-ink">Updates</h1>
            <p className="mt-1.5 max-w-140 text-sm text-ink-secondary">
              How often the platform gets new data from EXPA. It refreshes on its own, and you can
              refresh anything now.
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
              ? `EP data refreshes every 5 minutes until ${formatOfficeTime(until)} (Beirut time). After that, it goes back to once a day.`
              : "EP data refreshes once a day. During a hackathon, turn this on to refresh every 5 minutes. It turns itself off when the time you choose is up."}
          </p>

          <HackathonSwitch on={hackathon} />
        </section>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface-raised px-7 py-6.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">What refreshes</h2>

          <ul className="flex flex-col gap-3">
            <JobRow
              job="events"
              title="EP data"
              description="New applications, approvals and realizations, EP managers and the sign-up sheet. Points are recalculated right after."
              schedule={hackathon ? "Every 5 minutes (hackathon mode)" : "Every night"}
              button="Refresh now"
              pending="Refreshing…"
              state={events}
              now={now}
            />
            <JobRow
              job="roster"
              title="Members"
              description="Who holds a member position in each LC this term. Refresh after a term handover or when someone new joins."
              schedule="On the 1st of every month"
              button="Refresh now"
              pending="Refreshing…"
              state={roster}
              now={now}
            />
            <li className="flex flex-col gap-1.5 rounded-2xl bg-surface px-5 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-base font-semibold text-ink">LC rankings</h3>
                <span className={`${CHIP} bg-apd-wash text-apd-ink`}>Always live</span>
              </div>
              <p className="text-[13px] text-ink-secondary">
                Come straight from AIESEC&rsquo;s own figures each time someone opens an LC
                ranking, and every minute on the TV screen. There&rsquo;s nothing to refresh.
              </p>
            </li>
          </ul>
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
          <Fact term="Last refreshed">
            {state?.lastSucceededAt
              ? `${timeAgo(state.lastSucceededAt, now)} (${formatOfficeTime(state.lastSucceededAt)})`
              : "Not yet"}
          </Fact>
          {state?.lastStartedAt && state.lastTrigger ? (
            <Fact term="Last attempt">
              {`${timeAgo(state.lastStartedAt, now)}, ${TRIGGER_LABEL[state.lastTrigger]}`}
            </Fact>
          ) : null}
        </dl>

        {status === "failed" ? (
          <p className="mt-1 rounded-xl bg-break-wash px-3.5 py-2 text-[13px] text-ink">
            {state?.lastError ? failedSteps(state.lastError) : "The last refresh didn't finish."} Try
            again. If it keeps happening, let whoever looks after the platform know.
          </p>
        ) : status === "interrupted" ? (
          <p className="mt-1 rounded-xl bg-re-wash px-3.5 py-2 text-[13px] text-ink">
            The last refresh was cut off before it finished. Try again.
          </p>
        ) : null}

        {behind && status !== "failed" ? (
          <p className="mt-1 rounded-xl bg-re-wash px-3.5 py-2 text-[13px] text-ink">
            {state?.lastSucceededAt
              ? "This hasn't refreshed on schedule. Refresh it now. If it keeps falling behind, let whoever looks after the platform know."
              : "This hasn't refreshed yet. Refresh it now."}
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

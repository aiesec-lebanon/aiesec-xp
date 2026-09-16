import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { activeWindow, weeklyPoints } from "@/lib/dashboard";
import { personalProgress } from "@/lib/leaderboard";
import { STAGE, STAGE_TINT, stageColour } from "@/lib/design/tokens";

import { ReduceMotionToggle } from "@/components/motion/reduce-motion-toggle";
import { BrandMark, MemberPill } from "@/components/studio/chrome";
import { Dock } from "@/components/studio/dock";
import { GrowBar, Rise } from "@/components/studio/motion";

import { CharacterLab } from "./character-lab";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

const PROGRAMMES: Record<number, string> = { 7: "GV", 8: "GTa", 9: "GTe" };

const STAGES: Record<string, string> = {
  APL: "Application",
  APD: "Approved",
  RE: "Realized",
  APD_BROKEN: "Approval broken",
  RE_BROKEN: "Realization broken",
};

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireMemberPage("/me");
  const params = await searchParams;

  const [progress, window] = await Promise.all([personalProgress(user.id), activeWindow()]);

  const weeks = weeklyPoints(progress.trail, window);
  const tallest = weeks.reduce((most, week) => Math.max(most, week.points), 0);
  const total = Math.round(weeks.reduce((sum, week) => sum + week.points, 0) * 10_000) / 10_000;

  const pageCount = Math.max(1, Math.ceil(progress.trail.length / PER_PAGE));
  const page = Math.min(
    pageCount,
    Math.max(1, params.page && /^\d+$/.test(params.page) ? Number(params.page) : 1)
  );
  const events = progress.trail.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <main className="flex min-h-dvh flex-col bg-wall pb-10">
      <div className="flex items-center justify-between gap-4 px-6 pt-8 sm:px-11">
        <BrandMark />
        <MemberPill name={user.fullName} />
      </div>

      <div className="px-6 pt-7 sm:px-16">
        <h1 className="font-display text-[30px] font-semibold text-ink">Your history</h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Every point explained — nothing here happens without a row below it.
        </p>
      </div>

      <Rise
        delay={0.06}
        className="mx-6 mt-7 rounded-[22px] bg-surface-raised px-8 py-7 shadow-e2 sm:mx-16"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
            Points by week
          </h2>
          <p className="text-[13px] text-ink-secondary">
            {total} points{window ? ` · ${window.label}` : ""}
          </p>
        </div>

        {weeks.length === 0 ? (
          <p className="mt-6 text-[13px] text-ink-secondary">
            Nothing has scored for you yet, so there is no shape to draw.
          </p>
        ) : (
          <ul className="mt-6 flex h-35 items-end gap-4">
            {weeks.map((week, index) => (
              <li
                key={week.startsAt.toISOString()}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span
                  className="tabular text-xs font-bold"
                  style={{ color: week.points > 0 ? STAGE_TINT.APL.ink : "var(--ink-faint)" }}
                >
                  {week.points}
                </span>
                <GrowBar
                  height={tallest === 0 ? 0 : week.points / tallest}
                  colour={week.points > 0 ? STAGE.APL : "var(--surface-sunken)"}
                  delay={index * 0.05}
                />
                <span className="text-[10px] text-ink-faint">{week.label}</span>
              </li>
            ))}
          </ul>
        )}
      </Rise>

      <Rise
        delay={0.1}
        className="mx-6 mt-6 flex flex-col rounded-[22px] bg-surface-raised px-5 py-3 shadow-e2 sm:mx-16"
      >
        <div className="grid grid-cols-[1fr_auto] gap-4 px-3 py-3.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint sm:grid-cols-[150px_110px_1fr_110px]">
          <span>Stage</span>
          <span className="hidden sm:block">Product</span>
          <span className="hidden sm:block">When</span>
          <span className="text-right">Points</span>
        </div>

        {events.length === 0 ? (
          <p className="px-3 py-6 text-[13px] text-ink-secondary">
            Points appear once an EP assigned to you reaches a funnel stage inside the current
            window.
          </p>
        ) : (
          events.map((entry, index) => (
            <div
              key={`${entry.eventType}-${entry.occurredAt.toISOString()}-${index}`}
              className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-surface sm:grid-cols-[150px_110px_1fr_110px]"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2 flex-none rounded-[3px]"
                  style={{ background: stageColour(entry.eventType) }}
                />
                <span className="text-[13px] font-semibold text-ink">
                  {STAGES[entry.eventType] ?? entry.eventType}
                </span>
              </span>
              <span className="hidden text-[13px] text-ink-secondary sm:block">
                {PROGRAMMES[entry.programmeId] ?? entry.programmeId}
              </span>
              <span className="hidden text-[13px] text-ink-secondary sm:block">
                {entry.occurredAt.toISOString().slice(0, 10)}
              </span>
              <span
                className="tabular text-right text-base font-bold"
                style={{ color: entry.points < 0 ? STAGE_TINT.BREAK.ink : "var(--ink-primary)" }}
              >
                {entry.points > 0 ? `+${entry.points}` : entry.points}
              </span>
            </div>
          ))
        )}

        {pageCount > 1 ? (
          <div className="flex items-center gap-2 px-3 pb-1 pt-2">
            <span className="mr-auto font-mono text-[10px] text-ink-faint">
              {(page - 1) * PER_PAGE + 1}–{Math.min(progress.trail.length, page * PER_PAGE)} of{" "}
              {progress.trail.length}
            </span>
            <PageLink href={`/me?page=${page - 1}`} disabled={page === 1}>
              Prev
            </PageLink>
            <PageLink href={`/me?page=${page + 1}`} disabled={page === pageCount}>
              Next
            </PageLink>
          </div>
        ) : null}
      </Rise>

      <Rise
        delay={0.14}
        className="mx-6 mt-6 flex flex-col gap-5.5 rounded-[22px] bg-surface p-8 shadow-e2 sm:mx-16"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">Character lab</h2>
          <span className="text-xs text-ink-faint">
            items stay fixed for now — only colour, and nothing is saved yet
          </span>
        </div>
        <CharacterLab name={user.fullName} />
      </Rise>

      <div className="mx-6 mt-6 flex items-center justify-between gap-6 rounded-[22px] bg-surface-raised px-7 py-6 shadow-e2 sm:mx-16">
        <div>
          <p className="text-sm font-semibold text-ink">Reduce motion</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Turns off idle animation and page transitions across AIESEC XP.
          </p>
        </div>
        <ReduceMotionToggle hideLabel />
      </div>

      <div className="sticky bottom-7 z-20 mt-8 flex justify-center px-6">
        <Dock />
      </div>
    </main>
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
    "rounded-[9px] border border-line bg-surface-raised px-3.5 py-1.5 text-xs font-semibold text-ink";

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

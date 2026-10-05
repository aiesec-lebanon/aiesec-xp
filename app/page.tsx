import { redirect } from "next/navigation";

import { requireMemberPage } from "@/lib/auth/guards";
import { activeWindow, closingMove, pace } from "@/lib/dashboard";
import { personalProgress } from "@/lib/leaderboard";
import { STAGE, STAGE_TINT, TEXT } from "@/lib/design/tokens";
import type { CharacterBeat } from "@/lib/design/character";
import { firstName } from "@/lib/design/names";
import { formatPoints, formatSignedPoints } from "@/lib/design/points";

import { CharacterAvatar } from "@/components/studio/character";
import { BeatOnHover } from "@/components/studio/hero-beat";
import { HeroStage } from "@/components/studio/hero-stage";
import { memberAvatar, memberAvatars } from "@/lib/design/avatar";
import { Cyclorama } from "@/components/studio/cyclorama";
import { WindowLabel } from "@/components/studio/chrome";
import { GhostNumber, Rise } from "@/components/studio/motion";
import { StatChips, type Chip, type ChipEvent } from "@/components/studio/stat-chips";

export const dynamic = "force-dynamic";

const PROGRAMMES: Record<number, string> = { 7: "GV", 8: "GTa", 9: "GTe" };

const STAGES: Record<string, string> = {
  APL: "Application",
  APD: "Approved",
  RE: "Realized",
  APD_BROKEN: "Approval broken",
  RE_BROKEN: "Realization broken",
};

function unit(thresholdType: string): string {
  switch (thresholdType) {
    case "POINTS":
      return "points";
    case "APL_COUNT":
      return "applications";
    case "APD_COUNT":
      return "approvals";
    case "RE_COUNT":
      return "realizations";
    default:
      return "";
  }
}

export default async function HomePage() {
  const user = await requireMemberPage("/");
  const [progress, window, avatar] = await Promise.all([
    personalProgress(user.id),
    activeWindow(),
    memberAvatar(user.id, user.fullName),
  ]);


  if (!avatar.chosen) redirect("/welcome");

  const standing = progress.standing;
  const points = standing?.points ?? 0;
  const next = pace(progress, window);

  // Rank 1 gets no beat here: `HeroCharacter` replays its own celebration on a timer.
  const leading = points > 0 && standing?.rank === 1;
  const heroBeat: CharacterBeat | null =
    points === 0 || leading ? null : next === null ? "thumbsUp" : null;

  const gap = progress.nextUp
    ? Math.round((progress.nextUp.points - points) * 10_000) / 10_000
    : 0;
  const nudge = progress.nextUp ? await closingMove(gap) : null;

  const chasing = progress.nextUp
    ? (
        await memberAvatars([
          { id: progress.nextUp.memberId, fullName: progress.nextUp.fullName },
        ])
      ).get(progress.nextUp.memberId)
    : undefined;

  const eventsFor = (prefix: string): ChipEvent[] =>
    progress.trail
      .filter((entry) => entry.eventType.startsWith(prefix))
      .map((entry) => ({
        stage: STAGES[entry.eventType] ?? entry.eventType,
        product: PROGRAMMES[entry.programmeId] ?? String(entry.programmeId),
        date: entry.occurredAt.toISOString().slice(0, 10),
        points: formatSignedPoints(entry.points),
      }));

  const chips: Chip[] = [
    {
      key: "APL",
      kind: "stage",
      accent: STAGE.APL,
      ink: STAGE_TINT.APL.ink,
      label: "APL",
      value: standing?.aplCount ?? 0,
      caption: (standing?.aplCount ?? 0) === 1 ? "application" : "applications",
      events: eventsFor("APL"),
      empty: "No applications count for you in this period yet.",
    },
    {
      key: "APD",
      kind: "stage",
      accent: STAGE.APD,
      ink: STAGE_TINT.APD.ink,
      label: "APD",
      value: standing?.apdCount ?? 0,
      caption: (standing?.apdCount ?? 0) === 1 ? "approval" : "approvals",
      events: eventsFor("APD"),
      empty: "No approvals count for you in this period yet.",
    },
    {
      key: "RE",
      kind: "stage",
      accent: STAGE.RE,
      ink: STAGE_TINT.RE.ink,
      label: "RE",
      value: standing?.reCount ?? 0,
      caption: (standing?.reCount ?? 0) === 1 ? "realization" : "realizations",
      events: eventsFor("RE"),
      empty: "No realizations count for you in this period yet.",
    },
    {
      key: "pace",
      kind: "pace",
      accent: TEXT.primary,
      ink: TEXT.secondary,
      label: "Pace",
      value: next?.perWeek ?? null,
      valueSuffix: next?.perWeek === null || next === null ? undefined : "/ week",
      caption:
        next === null
          ? "nothing left to chase"
          : next.perWeek === null
            ? `${formatPoints(next.remaining)} ${unit(next.reward.thresholdType)} to go`
            : `to reach ${next.reward.label} before the period ends`,
      empty:
        next === null
          ? "You've earned every reward. Well done!"
          : "Your weekly pace will show once the period has an end date.",
    },
  ];

  if (progress.rewards.length > 0) {
    const reward = next?.reward ?? progress.rewards[progress.rewards.length - 1]!;
    chips.push({
      key: "reward",
      kind: "reward",
      accent: STAGE_TINT.RE.ink,
      ink: STAGE_TINT.RE.ink,
      wash: STAGE_TINT.RE.wash,
      label: next ? "Next reward" : "Rewards",
      value: null,
      headline: reward.label,
      caption: next
        ? `${formatPoints(next.remaining)} ${unit(reward.thresholdType)} to go`
        : "every reward earned",
      ladder: progress.rewards.map((step) => ({
        label: step.label,
        detail: `${formatPoints(step.current)} of ${formatPoints(step.threshold)} ${unit(step.thresholdType)}`,
        earned: step.earned,
      })),
    });
  }

  return (
    // Below `lg` the columns stack and the page scrolls; from `lg` it is pinned to the viewport.
    <Cyclorama
      floor="30%"
      className="flex min-h-full shrink-0 flex-col lg:min-h-0 lg:flex-1 lg:shrink"
    >
      <div className="page-end flex flex-1 flex-col gap-6 px-6 pt-6 sm:px-11 lg:min-h-0 lg:gap-4">
        {window ? (
          <Rise className="flex justify-center" delay={0.05}>
            <WindowLabel>
              {window.label}
              {window.daysLeft === null
                ? ""
                : window.daysLeft === 0
                  ? " · ends today"
                  : ` · ends in ${window.daysLeft} day${window.daysLeft === 1 ? "" : "s"}`}
            </WindowLabel>
          </Rise>
        ) : (
          <Rise className="flex justify-center" delay={0.05}>
            <WindowLabel>No scoring period set yet</WindowLabel>
          </Rise>
        )}

        <HeroStage
          name={user.fullName}
          idOverride={avatar.character.id}
          mood={points > 0 ? "calm" : "empty"}
          beat={heroBeat}
          leading={leading}
          points={points}
          greetKey="dashboard"
          ghost={<GhostNumber>{formatPoints(points)}</GhostNumber>}
          left={
            <Rise delay={0.12} className="hero-column self-start">
              <p className="tabular text-[clamp(56px,7vw,96px)] font-bold leading-[0.9] text-ink">
                {formatPoints(points)}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink-secondary">
                points this period
              </p>
              <span aria-hidden className="mt-4 block h-[3px] w-11 rounded-sm bg-stage-apl" />
              <p className="mt-4 max-w-[230px] text-sm leading-relaxed text-ink-secondary">
                Each point comes from an EP you helped move forward. Open a card below to see which.
              </p>
            </Rise>
          }
          right={
            <Rise delay={0.18} className="hero-column self-start lg:text-right">
              {standing ? (
                <div className="flex items-baseline gap-2 lg:justify-end">
                  <span className="tabular text-[clamp(56px,7vw,96px)] font-bold leading-[0.9] text-ink">
                    {standing.rank}
                  </span>
                  <span className="tabular text-[30px] font-semibold text-ink-faint">
                    /{progress.totalMembers}
                  </span>
                </div>
              ) : (
                <p className="tabular text-[clamp(44px,5vw,64px)] font-bold leading-none text-ink-faint">
                  Not ranked yet
                </p>
              )}
              <p className="mt-0.5 text-[15px] font-semibold text-ink-secondary">
                rank in Lebanon
              </p>
              <span
                aria-hidden
                className="mt-4 block h-[3px] w-11 rounded-sm bg-stage-re lg:ml-auto"
              />

              {progress.nextUp ? (
                <BeatOnHover beat="point" className="mt-4 inline-flex items-center gap-3 rounded-[18px] bg-surface-raised px-4 py-3 text-left shadow-e2">
                  <CharacterAvatar
                    name={progress.nextUp.fullName}
                    idOverride={chasing?.id}
                    size={38}
                    rounded="rounded-xl"
                    tone="bg-surface-sunken"
                  />
                  <div>
                    <p className="text-[13px] font-semibold text-ink">
                      {gap} point{gap === 1 ? "" : "s"} behind {firstName(progress.nextUp.fullName)}
                    </p>
                    {nudge ? <p className="text-xs text-ink-secondary">{nudge}</p> : null}
                  </div>
                </BeatOnHover>
              ) : standing?.rank === 1 ? (
                <p className="mt-4 text-[13px] font-semibold text-ink">
                  Nobody is ahead of you.
                </p>
              ) : null}
            </Rise>
          }
        />

        <Rise delay={0.24} className="shrink-0">
          <StatChips chips={chips} />
        </Rise>
      </div>
    </Cyclorama>
  );
}

import { redirect } from "next/navigation";

import { requireMemberPage } from "@/lib/auth/guards";
import { activeWindow, closingMove, pace } from "@/lib/dashboard";
import { personalProgress } from "@/lib/leaderboard";
import { STAGE, STAGE_TINT, TEXT } from "@/lib/design/tokens";

import { Character, CharacterAvatar, ContactShadow } from "@/components/studio/character";
import { memberAvatar } from "@/lib/design/avatar";
import { Cyclorama } from "@/components/studio/cyclorama";
import { Dock } from "@/components/studio/dock";
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

function firstName(full: string): string {
  return full.split(" ")[0] ?? full;
}

export default async function HomePage() {
  const user = await requireMemberPage("/");
  const [progress, window, avatar] = await Promise.all([
    personalProgress(user.id),
    activeWindow(),
    memberAvatar(user.id, user.fullName),
  ]);


  // First run: a member picks their character before anything else (D-52).
  if (!avatar.chosen) redirect("/welcome");

  const standing = progress.standing;
  const points = standing?.points ?? 0;
  const next = pace(progress, window);

  const gap = progress.nextUp
    ? Math.round((progress.nextUp.points - points) * 10_000) / 10_000
    : 0;
  const nudge = progress.nextUp ? await closingMove(gap) : null;

  const eventsFor = (prefix: string): ChipEvent[] =>
    progress.trail
      .filter((entry) => entry.eventType.startsWith(prefix))
      .map((entry) => ({
        stage: STAGES[entry.eventType] ?? entry.eventType,
        product: PROGRAMMES[entry.programmeId] ?? String(entry.programmeId),
        date: entry.occurredAt.toISOString().slice(0, 10),
        points: entry.points > 0 ? `+${entry.points}` : String(entry.points),
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
      empty: "No application has scored for you inside this window yet.",
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
      empty: "No approval has scored for you inside this window yet.",
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
      empty: "No realization has scored for you inside this window yet.",
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
            ? `${next.remaining} ${unit(next.reward.thresholdType)} to go, no closing date set`
            : `to reach ${next.reward.threshold} before it closes`,
      empty:
        next === null
          ? "Every configured reward is already yours."
          : "Pace needs a display window with an end date before it can name a weekly number.",
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
        ? `${next.remaining} ${unit(reward.thresholdType)} to go`
        : "every reward earned",
      ladder: progress.rewards.map((step) => ({
        label: step.label,
        detail: `${step.current} of ${step.threshold} ${unit(step.thresholdType)}`,
        earned: step.earned,
      })),
    });
  }

  return (
    <Cyclorama floor="30%" className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col gap-8 px-6 pb-8 pt-8 sm:px-11">
        {window ? (
          <Rise className="flex justify-center" delay={0.05}>
            <WindowLabel>
              {window.label}
              {window.daysLeft === null
                ? " · no closing date"
                : window.daysLeft === 0
                  ? " · closes today"
                  : ` · closes in ${window.daysLeft} day${window.daysLeft === 1 ? "" : "s"}`}
            </WindowLabel>
          </Rise>
        ) : (
          <Rise className="flex justify-center" delay={0.05}>
            <WindowLabel>No display window is active</WindowLabel>
          </Rise>
        )}

        {/* The stage. The ghost numeral sits behind the body, the two readings
            flank it, and nothing moves except the idle breath. */}
        <div className="relative flex flex-1 items-end justify-center pt-10">
          <div className="absolute inset-x-0 top-0">
            <GhostNumber>{Math.round(points)}</GhostNumber>
          </div>

          <div className="relative z-10 grid w-full max-w-[1250px] grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Rise delay={0.12} className="self-start lg:pt-12">
              <p className="tabular text-[clamp(56px,7vw,96px)] font-bold leading-[0.9] text-ink">
                {points}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink-secondary">
                points this window
              </p>
              <span aria-hidden className="mt-4 block h-[3px] w-11 rounded-sm bg-stage-apl" />
              <p className="mt-4 max-w-[230px] text-sm leading-relaxed text-ink-secondary">
                Every point here is an EP you carried through a stage. Open a chip to see which.
              </p>
            </Rise>

            <div className="relative order-first flex flex-col items-center lg:order-none">
              <Character
                name={user.fullName}
                height={440}
                priority
                stage
                idOverride={avatar.character.id}
              />
              <ContactShadow width={300} height={52} className="-mt-3.5" />
            </div>

            <Rise delay={0.18} className="self-start lg:pt-12 lg:text-right">
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
                  unranked
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
                <div className="mt-4 inline-flex items-center gap-3 rounded-[18px] bg-surface-raised px-4 py-3 text-left shadow-e2">
                  <CharacterAvatar
                    name={progress.nextUp.fullName}
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
                </div>
              ) : standing?.rank === 1 ? (
                <p className="mt-4 text-[13px] font-semibold text-ink">
                  Nobody is ahead of you.
                </p>
              ) : null}
            </Rise>
          </div>
        </div>

        <Rise delay={0.24}>
          <StatChips chips={chips} />
        </Rise>
      </div>

      <div className="sticky bottom-7 z-20 flex justify-center px-6">
        <Dock />
      </div>
    </Cyclorama>
  );
}

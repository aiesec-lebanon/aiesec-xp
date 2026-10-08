import { redirect } from "next/navigation";

import { requireMemberPage } from "@/lib/auth/guards";
import { activeWindow, pace } from "@/lib/dashboard";
import { personalProgress, type PersonalProgress } from "@/lib/leaderboard";
import { memberAvatar } from "@/lib/design/avatar";
import { formatPoints } from "@/lib/design/points";
import { thresholdUnit } from "@/lib/scoring/labels";

import { CharacterAvatar } from "@/components/studio/character";
import { WindowLabel } from "@/components/studio/chrome";
import { Rise } from "@/components/studio/motion";

export const dynamic = "force-dynamic";

type Reward = PersonalProgress["rewards"][number];
type Standing = NonNullable<PersonalProgress["standing"]>;

// One road per thing a reward can be counted in. Each has its own scale, which
// is the point: a points target and an approval target can't share an axis.
const LANES = [
  { type: "POINTS", name: "Points", colour: "var(--ink-primary)", dot: "bg-ink", measure: (s: Standing) => s.points },
  { type: "APL_COUNT", name: "Applications", colour: "var(--stage-apl)", dot: "bg-stage-apl", measure: (s: Standing) => s.aplCount },
  { type: "APD_COUNT", name: "Approvals", colour: "var(--stage-apd)", dot: "bg-stage-apd", measure: (s: Standing) => s.apdCount },
  { type: "RE_COUNT", name: "Realizations", colour: "var(--stage-re)", dot: "bg-stage-re", measure: (s: Standing) => s.reCount },
] as const;

// The road is drawn in a 1000-wide box stretched to the lane, so x is a share
// of the width; y stays in pixels because the box's height is fixed.
const WIDTH = 1000;
const HEIGHT = 150;
const MIDDLE = 75;
const SWING = 14;
const END = 8;

function roadY(x: number, phase: number): number {
  return MIDDLE + SWING * Math.sin((x / WIDTH) * Math.PI * 2.2 + phase);
}

function roadPath(to: number, phase: number): string {
  const points = [`M${END} ${roadY(END, phase).toFixed(1)}`];
  for (let x = END + 10; x < to; x += 10) points.push(`L${x} ${roadY(x, phase).toFixed(1)}`);
  points.push(`L${to.toFixed(1)} ${roadY(to, phase).toFixed(1)}`);
  return points.join(" ");
}

function amount(thresholdType: string, value: number): string {
  return `${formatPoints(value)} ${thresholdUnit(thresholdType, value)}`;
}

function worth(reward: Reward): string | null {
  if (!reward.valueAmount) return null;
  return `${formatPoints(reward.valueAmount)}${reward.valueCurrency ? ` ${reward.valueCurrency}` : ""}`;
}

export default async function RewardsPage() {
  const user = await requireMemberPage("/rewards");
  const [progress, window, avatar] = await Promise.all([
    personalProgress(user.id),
    activeWindow(),
    memberAvatar(user.id, user.fullName),
  ]);

  if (!avatar.chosen) redirect("/welcome");

  const rewards = progress.rewards;
  const next = pace(progress, window);
  const earnedCount = rewards.filter((reward) => reward.earned).length;

  const lanes = LANES.flatMap((lane, index) => {
    const onLane = rewards
      .filter((reward) => reward.thresholdType === lane.type)
      .sort((a, b) => a.threshold - b.threshold);
    if (onLane.length === 0) return [];

    const current = progress.standing ? lane.measure(progress.standing) : 0;
    const scale = Math.max(current, ...onLane.map((reward) => reward.threshold)) * 1.2 || 1;
    const xOf = (value: number) => Math.min(WIDTH - END, Math.max(END, (value / scale) * WIDTH));
    const phase = index * 1.3;
    const youX = xOf(current);
    const ahead = onLane.find((reward) => !reward.earned);

    return [
      {
        ...lane,
        current,
        phase,
        youX,
        youY: roadY(youX, phase),
        caption: ahead
          ? `${amount(lane.type, Math.max(0, ahead.threshold - current))} to ${ahead.label}`
          : "Every reward on this road reached",
        markers: onLane.map((reward, position) => {
          const x = xOf(reward.threshold);
          return { reward, x, y: roadY(x, phase), below: position % 2 === 1 };
        }),
      },
    ];
  });

  return (
    <main className="page-end flex min-h-full shrink-0 flex-col bg-wall px-6 pt-6 sm:px-11">
      <div className="mx-auto flex w-full max-w-290 flex-col gap-6">
        <Rise className="flex justify-center" delay={0.05}>
          <WindowLabel>
            {window
              ? `${window.label}${
                  window.daysLeft === null
                    ? ""
                    : window.daysLeft === 0
                      ? " · ends today"
                      : ` · ends in ${window.daysLeft} day${window.daysLeft === 1 ? "" : "s"}`
                }`
              : "No scoring period set yet"}
          </WindowLabel>
        </Rise>

        <Rise delay={0.1} className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <CharacterAvatar
              name={user.fullName}
              idOverride={avatar.character.id}
              size={64}
              rounded="rounded-[18px]"
              tone="bg-surface-sunken"
            />
            <div>
              <h1 className="font-display text-[34px] font-semibold leading-tight text-ink">
                Rewards by what counts
              </h1>
            </div>
          </div>

          {next ? (
            <div className="flex flex-col gap-0.5 rounded-[18px] bg-re-wash px-4.5 py-3.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6a4e0c]">
                Next up
              </span>
              <span className="font-display text-lg font-semibold text-ink">{next.reward.label}</span>
              <span className="text-[13px] font-semibold text-[#6a4e0c]">
                {amount(next.reward.thresholdType, next.remaining)} to go
                {next.perWeek !== null ? ` · about ${formatPoints(next.perWeek)} a week` : ""}
              </span>
            </div>
          ) : rewards.length > 0 ? (
            <p className="rounded-[18px] bg-apd-wash px-4.5 py-3.5 text-[13px] font-semibold text-apd-ink">
              You&rsquo;ve earned every reward. Well done!
            </p>
          ) : null}
        </Rise>

        <Rise
          delay={0.16}
          className="rounded-[28px] bg-surface-raised px-5 py-3 shadow-e3 sm:px-10 sm:py-5"
        >
          <section aria-label="Reward roads">
            {lanes.length === 0 ? (
              <p className="py-6 text-[13px] text-ink-secondary">
                No rewards have been set for this period yet. Check back soon.
              </p>
            ) : (
              <ul>
                {lanes.map((lane) => (
                  <li
                    key={lane.type}
                    className="grid grid-cols-1 items-center gap-x-7 gap-y-1 border-b border-surface-sunken py-3 last:border-b-0 md:grid-cols-[200px_minmax(0,1fr)]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
                        <span aria-hidden className={`size-2.5 rounded-[3px] ${lane.dot}`} />
                        {lane.name}
                      </h2>
                      <p className="tabular text-[40px] font-extrabold leading-none text-ink">
                        {formatPoints(lane.current)}
                        <span className="sr-only"> {thresholdUnit(lane.type, lane.current)} so far</span>
                      </p>
                      <p className="text-xs text-ink-secondary">{lane.caption}</p>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="relative min-w-140" style={{ height: HEIGHT }}>
                        <svg
                          aria-hidden
                          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                          preserveAspectRatio="none"
                          className="absolute inset-0 size-full overflow-visible"
                        >
                          <path
                            d={roadPath(WIDTH - END, lane.phase)}
                            fill="none"
                            stroke="var(--surface-sunken)"
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d={roadPath(WIDTH - END, lane.phase)}
                            fill="none"
                            stroke="var(--surface-raised)"
                            strokeWidth={2}
                            strokeDasharray="8 12"
                            vectorEffect="non-scaling-stroke"
                          />
                          <path
                            d={roadPath(lane.youX, lane.phase)}
                            fill="none"
                            stroke={lane.colour}
                            strokeWidth={14}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>

                        <ol>
                          {lane.markers.map(({ reward, x, y, below }) => {
                            const isNext = next?.reward.id === reward.id;
                            const value = worth(reward);
                            // Labels near either end hang inward so the scroll box doesn't clip them.
                            const anchor =
                              x < WIDTH * 0.15
                                ? "items-start -translate-x-[11px]"
                                : x > WIDTH * 0.85
                                  ? "items-end -translate-x-[calc(100%-11px)]"
                                  : "items-center -translate-x-1/2";
                            return (
                              <li
                                key={reward.id}
                                className={`absolute flex gap-1.5 ${anchor} ${
                                  below ? "flex-col-reverse" : "-translate-y-full flex-col"
                                }`}
                                style={{
                                  left: `${(x / WIDTH) * 100}%`,
                                  top: below ? y - 11 : y + 11,
                                }}
                              >
                                <span
                                  title={reward.description ?? undefined}
                                  className={`whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-bold ${
                                    reward.earned
                                      ? "bg-apd-wash text-apd-ink"
                                      : isNext
                                        ? "bg-re-wash text-[#6a4e0c] ring-2 ring-stage-re"
                                        : "bg-surface text-ink-secondary ring-1 ring-line"
                                  }`}
                                >
                                  {reward.label} · {formatPoints(reward.threshold)}
                                  {value ? ` · ${value}` : ""}
                                  <span className="sr-only">
                                    {" "}
                                    {thresholdUnit(reward.thresholdType, reward.threshold)},{" "}
                                    {reward.earned ? "earned" : isNext ? "next up" : "not yet earned"}
                                  </span>
                                </span>
                                <span
                                  aria-hidden
                                  className={`size-5.5 rounded-full shadow-[0_0_0_3px_var(--surface-raised),0_2px_6px_rgba(23,22,20,0.15)] ${
                                    reward.earned
                                      ? "bg-stage-re"
                                      : isNext
                                        ? "bg-surface-raised ring-[3px] ring-inset ring-stage-re"
                                        : "bg-line"
                                  }`}
                                />
                              </li>
                            );
                          })}
                        </ol>

                        <div
                          aria-hidden
                          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl outline-2 outline-offset-[3px] outline-stage-apl"
                          style={{ left: `${(lane.youX / WIDTH) * 100}%`, top: lane.youY }}
                        >
                          <CharacterAvatar
                            name={user.fullName}
                            idOverride={avatar.character.id}
                            size={36}
                            rounded="rounded-xl"
                            tone="bg-surface-sunken ring-[3px] ring-surface-raised"
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Rise>
      </div>
    </main>
  );
}

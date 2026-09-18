import { requireMemberPage } from "@/lib/auth/guards";
import { activeWindow, recentActivity, topMembers } from "@/lib/dashboard";
import { officeStandings } from "@/lib/leaderboard";

import { AutoRefresh } from "@/components/studio/auto-refresh";
import { CharacterAvatar } from "@/components/studio/character";
import { memberAvatars } from "@/lib/design/avatar";
import { BrandMark } from "@/components/studio/chrome";
import { Lift } from "@/components/studio/motion";
import { RollingNumber } from "@/components/studio/rolling-number";

export const dynamic = "force-dynamic";

const STAGES: Record<string, string> = {
  APL: "carried an application",
  APD: "landed an approval",
  RE: "realized an EP",
  APD_BROKEN: "lost an approval",
  RE_BROKEN: "lost a realization",
};

export default async function TvPage() {
  // An office screen is signed in once and left running; there is no anonymous
  // mode, because everything on this page is member data (D-16).
  await requireMemberPage("/tv");

  const [{ standings: entities, analyticsOk }, top, window, activity] = await Promise.all([
    officeStandings(),
    topMembers(10),
    activeWindow(),
    recentActivity(8),
  ]);

  // The board and the ticker both show people, so both show the character each
  // of them picked.
  const characters = await memberAvatars(
    [...top, ...activity].map((entry) => ({ id: entry.memberId, fullName: entry.fullName })),
  );

  // Rank, points and the per-entity APL/APD/RE counts all come from AIESEC's
  // own analytics API (D-56) -- a live, external figure nobody can dispute,
  // rather than a reflection of how completely this product's assignment
  // register happens to cover that LC. "All entities" is the sum of the rows
  // actually shown, so it never carries activity from a closed office that
  // has no row of its own.
  const totals = entities.reduce(
    (sum, entity) => ({
      aplCount: sum.aplCount + entity.aplCount,
      apdCount: sum.apdCount + entity.apdCount,
      reCount: sum.reCount + entity.reCount,
    }),
    { aplCount: 0, apdCount: 0, reCount: 0 },
  );

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-wall">
      <AutoRefresh seconds={60} />
      <header className="flex shrink-0 items-center justify-between gap-6 px-[clamp(1.5rem,3vw,3.5rem)] py-[clamp(0.75rem,1.8vh,1.75rem)]">
        {/* Already a link home, which is the only way off this screen now that
            it carries no chrome. */}
        <BrandMark size={38} type={26} />
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full bg-stage-apd"
            style={{ boxShadow: "0 0 0 5px var(--stage-apd-wash)" }}
          />
          <span className="font-mono text-[15px] uppercase tracking-[0.1em] text-ink-secondary">
            Live
            {window
              ? ` · ${window.label}${
                  window.daysLeft === null ? "" : ` closes in ${window.daysLeft} days`
                }`
              : " · no display window"}
            {analyticsOk ? "" : " · analytics unavailable"}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-[clamp(1rem,1.6vw,2rem)] px-[clamp(1.5rem,3vw,3.5rem)] pb-[clamp(1rem,2vh,2.25rem)] lg:grid-cols-[1fr_auto]">
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-[clamp(0.5rem,1vh,1rem)] shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">
            Entities
          </h2>
          <ol className="flex min-h-0 flex-[3] flex-col gap-[clamp(0.4rem,0.9vh,0.875rem)]">
            {entities.map((entity) => (
              <Lift
                as="li"
                lift={0}
                layout
                key={String(entity.officeId)}
                className="flex min-h-0 flex-1 items-center gap-5 rounded-2xl bg-surface-raised px-5 shadow-e1"
              >
                <span className="tabular w-8.5 text-2xl font-bold text-ink-faint">
                  <RollingNumber value={entity.rank} />
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[22px] font-semibold text-ink">
                  {entity.officeName}
                </span>
                <span className="hidden gap-2.5 sm:flex">
                  <Tile label="APL" value={entity.aplCount} wash="bg-apl-wash" ink="text-apl-ink" />
                  <Tile label="APD" value={entity.apdCount} wash="bg-apd-wash" ink="text-apd-ink" />
                  <Tile label="RE" value={entity.reCount} wash="bg-re-wash" ink="text-re-ink" />
                </span>
                <span className="tabular w-19 text-right text-4xl font-bold text-ink">
                  <RollingNumber value={entity.points} />
                </span>
              </Lift>
            ))}
          </ol>

          {/* The column ran out of rows halfway down. What belongs in the gap
              is the sum no single row carries: APL, APD and RE across every
              entity. */}
          <div className="mt-[clamp(0.5rem,1.2vh,2rem)] flex min-h-0 flex-[2] flex-col justify-center rounded-3xl bg-surface-raised px-[clamp(1.5rem,2.5vw,2.5rem)] py-[clamp(1rem,2.2vh,2rem)] shadow-e1">
            <p className="shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">
              All entities
            </p>
            <div className="mt-[clamp(0.5rem,1.4vh,1.25rem)] flex min-h-0 flex-1 items-stretch gap-[clamp(0.75rem,1.2vw,1.5rem)]">
              <Tile label="APL" value={totals.aplCount} wash="bg-apl-wash" ink="text-apl-ink" size="lg" />
              <Tile label="APD" value={totals.apdCount} wash="bg-apd-wash" ink="text-apd-ink" size="lg" />
              <Tile label="RE" value={totals.reCount} wash="bg-re-wash" ink="text-re-ink" size="lg" />
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col lg:w-[620px]">
          <h2 className="mb-[clamp(0.5rem,1vh,1rem)] shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">
            Top 10, individual
          </h2>
          <ol className="flex min-h-0 flex-1 flex-col gap-[clamp(0.2rem,0.5vh,0.375rem)]">
            {top.map((standing) => {
              const leading = standing.rank === 1;
              return (
                <Lift
                  as="li"
                  lift={0}
                  layout
                  key={String(standing.memberId)}
                  className={`flex min-h-0 flex-1 items-center gap-3.5 rounded-xl px-4 ${
                    leading ? "bg-re-wash" : "bg-surface-raised shadow-e1"
                  }`}
                >
                  <span
                    className={`tabular w-7 text-[17px] font-bold ${
                      leading ? "text-re-ink" : "text-ink-faint"
                    }`}
                  >
                    <RollingNumber value={standing.rank} />
                  </span>
                  <CharacterAvatar
                    name={standing.fullName}
                    idOverride={characters.get(standing.memberId)?.id}
                    size={36}
                    rounded="rounded-[11px]"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {standing.fullName}
                  </span>
                  <span className="tabular text-[19px] font-bold text-ink">
                    <RollingNumber value={standing.points} />
                  </span>
                </Lift>
              );
            })}
          </ol>
        </section>
      </div>

      {activity.length > 0 ? (
        <div className="flex h-[clamp(64px,9vh,120px)] shrink-0 items-center overflow-hidden bg-ink">
          {/* The strip is duplicated so the CSS translate of -50% lands exactly
              on the start of the second copy and the loop has no seam. */}
          <div className="tv-ticker flex shrink-0 items-center gap-14 whitespace-nowrap pl-14">
            {[0, 1].map((copy) =>
              activity.map((item, index) => (
                <div key={`${copy}-${index}`} className="flex items-center gap-3.5">
                  <CharacterAvatar
                    name={item.fullName}
                    idOverride={characters.get(item.memberId)?.id}
                    size={40}
                    rounded="rounded-xl"
                    tone="bg-[#2a2926]"
                  />
                  <span className="text-[17px] text-wall">
                    <b>{item.fullName}</b> {STAGES[item.eventType] ?? item.eventType}
                  </span>
                  <span className="tabular text-[19px] font-bold text-re-mid">
                    {item.points > 0 ? `+${item.points}` : item.points}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Tile({
  label,
  value,
  wash,
  ink,
  size = "sm",
}: {
  label: string;
  value: number;
  wash: string;
  ink: string;
  size?: "sm" | "lg";
}) {
  if (size === "lg") {
    return (
      <span className={`flex flex-1 flex-col items-center justify-center rounded-2xl ${wash}`}>
        <span className={`tabular block text-[clamp(28px,5vh,64px)] font-bold leading-none ${ink}`}>
          {value}
        </span>
        <span className={`mt-1.5 block text-sm font-bold tracking-[0.08em] ${ink}`}>{label}</span>
      </span>
    );
  }

  return (
    <span className={`block rounded-xl px-4 py-2 text-center ${wash}`}>
      <span className={`tabular block text-xl font-bold ${ink}`}>{value}</span>
      <span className={`block text-[10px] font-bold tracking-[0.06em] ${ink}`}>{label}</span>
    </span>
  );
}

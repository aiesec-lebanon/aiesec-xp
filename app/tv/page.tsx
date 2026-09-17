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

  const [entities, top, window, activity] = await Promise.all([
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

  const totals = entities.reduce(
    (sum, entity) => ({
      points: sum.points + entity.points,
      aplCount: sum.aplCount + entity.aplCount,
      apdCount: sum.apdCount + entity.apdCount,
      reCount: sum.reCount + entity.reCount,
      members: sum.members + entity.memberCount,
    }),
    { points: 0, aplCount: 0, apdCount: 0, reCount: 0, members: 0 },
  );

  return (
    <main className="flex min-h-dvh flex-col bg-wall">
      <AutoRefresh seconds={60} />
      <header className="flex items-center justify-between gap-6 px-14 py-7">
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
          </span>
        </div>
      </header>

      <div className="grid flex-1 gap-8 px-14 pb-10 xl:grid-cols-[1fr_auto]">
        <section className="flex flex-col">
          <h2 className="mb-5 text-[15px] font-bold uppercase tracking-[0.1em] text-ink">
            Entities
          </h2>
          <ol className="flex flex-col gap-3.5">
            {entities.map((entity) => (
              <Lift
                as="li"
                lift={0}
                layout
                key={String(entity.officeId)}
                className="flex items-center gap-5 rounded-2xl bg-surface-raised px-5 py-4 shadow-e1"
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
              is the number none of the rows carry: everyone, added up. */}
          <div className="mt-8 flex flex-1 flex-col justify-center rounded-3xl bg-surface-raised px-10 py-8 shadow-e1">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">
              All entities
            </p>
            <div className="mt-2 flex items-end gap-4">
              <p className="tabular text-[76px] font-bold leading-none text-ink">
                <RollingNumber value={totals.points} />
              </p>
              <p className="pb-3 text-[15px] font-semibold text-ink-secondary">
                points · {totals.members} member{totals.members === 1 ? "" : "s"}
              </p>
            </div>
            <div className="mt-6 flex gap-3.5">
              <Tile label="APL" value={totals.aplCount} wash="bg-apl-wash" ink="text-apl-ink" />
              <Tile label="APD" value={totals.apdCount} wash="bg-apd-wash" ink="text-apd-ink" />
              <Tile label="RE" value={totals.reCount} wash="bg-re-wash" ink="text-re-ink" />
            </div>
          </div>
        </section>

        <section className="xl:w-[620px]">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.1em] text-ink-faint">
            Top 10, individual
          </h2>
          <ol className="flex flex-col gap-1.5">
            {top.map((standing) => {
              const leading = standing.rank === 1;
              return (
                <Lift
                  as="li"
                  lift={0}
                  layout
                  key={String(standing.memberId)}
                  className={`flex items-center gap-3.5 rounded-xl px-4 py-2 ${
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
        <div className="flex h-30 items-center overflow-hidden bg-ink">
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
}: {
  label: string;
  value: number;
  wash: string;
  ink: string;
}) {
  return (
    <span className={`block rounded-xl px-4 py-2 text-center ${wash}`}>
      <span className={`tabular block text-xl font-bold ${ink}`}>{value}</span>
      <span className={`block text-[10px] font-bold tracking-[0.06em] ${ink}`}>{label}</span>
    </span>
  );
}

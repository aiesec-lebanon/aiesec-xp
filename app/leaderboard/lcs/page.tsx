import { requireMemberPage } from "@/lib/auth/guards";
import { individualStandings, officeStandings } from "@/lib/leaderboard";
import { resolveRange } from "@/lib/leaderboard-range";
import { termStart } from "@/lib/term";

import { CharacterGroup } from "@/components/studio/character-group";
import { memberAvatars } from "@/lib/design/avatar";
import { characterFor } from "@/lib/design/character";
import { GhostNumber, Rise } from "@/components/studio/motion";
import { Crown } from "@/components/studio/podium";
import { RangeFilter } from "@/components/studio/range-filter";

export const dynamic = "force-dynamic";

export default async function LcLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireMemberPage("/leaderboard/lcs");
  const params = await searchParams;

  const range = resolveRange(params, await termStart());

  const [{ standings, analyticsOk }, members] = await Promise.all([
    officeStandings(range),
    individualStandings(range),
  ]);

  const [leader, ...rest] = standings;

  // The bodies on the leading LC's plinth are its own top members, so the group
  // on the page is the group that put it there rather than decoration.
  const top = leader
    ? members.filter((standing) => standing.officeId === leader.officeId).slice(0, 5)
    : [];
  const characters = await memberAvatars(
    top.map((standing) => ({ id: standing.memberId, fullName: standing.fullName })),
  );
  const faces = top.map((standing) => ({
    name: standing.fullName,
    characterId: characters.get(standing.memberId)?.id,
  }));

  const totalMembers = standings.reduce((sum, entry) => sum + entry.memberCount, 0);

  return (
    // One column, not a split: there are three entities and there will be
    // three for a while, so the whole board is a leader and two rows under it.
    // flex-1 under the layout's header, and nothing here overflows it.
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wall">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-6 pt-2 pb-3 sm:px-11">
        <RangeFilter
          action="/leaderboard/lcs"
          from={range.from}
          to={range.to}
          min={range.floor}
          max={range.ceiling}
        />
        {/* <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
          {standings.length} entit{standings.length === 1 ? "y" : "ies"} · {totalMembers} members
        </p> */}
      </div>

      {!analyticsOk ? (
        <p className="mx-6 mb-2 shrink-0 rounded-2xl bg-break-wash px-5 py-2.5 text-center text-sm font-semibold text-ink sm:mx-11">
          Could not reach the AIESEC analytics API just now — LC totals may be out of date.
        </p>
      ) : null}

      {/* The leader takes whatever height is left after the two rows under it,
          so the board ends on the dock instead of running past it. Scrolls only
          if the window is too short for the group canvas to keep its floor. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-3 sm:px-11">
        {leader ? (
          <Rise
            delay={0.08}
            className="relative flex min-h-0 flex-1 flex-col items-center overflow-hidden rounded-3xl bg-surface-raised px-8 pb-5 pt-8 shadow-e2"
          >
            <div className="absolute inset-x-0 top-[-18px]">
              <GhostNumber>{Math.round(leader.points)}</GhostNumber>
            </div>

            <Crown />

            {/* One canvas for all of them, standing on one floor. Rank decides
                how far back a body stands, not how big it is drawn, so the group
                is a group rather than a row of different-sized cut-outs. */}
            <div className="relative z-10 min-h-[130px] w-full flex-1">
              <CharacterGroup
                members={faces.map((face) => ({
                  id: face.characterId ?? characterFor(face.name).id,
                  name: face.name,
                }))}
                heightFraction={0.82}
                floorFraction={0.08}
                flourish
                eager
              />
            </div>

            <div className="relative z-10 mt-3 shrink-0 text-center">
              <p className="font-display text-[22px] font-semibold text-ink">
                {leader.officeName}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                {leader.memberCount} member{leader.memberCount === 1 ? "" : "s"} · rank 1
              </p>
              <p className="tabular mt-2 text-[40px] font-bold leading-none text-ink xl:text-[52px]">
                {leader.points}
              </p>

              <div className="mt-3 flex justify-center gap-2.5">
                <StageTile label="APL" value={leader.aplCount} wash="bg-apl-wash" ink="text-apl-ink" />
                <StageTile label="APD" value={leader.apdCount} wash="bg-apd-wash" ink="text-apd-ink" />
                <StageTile label="RE" value={leader.reCount} wash="bg-re-wash" ink="text-re-ink" />
              </div>
            </div>
          </Rise>
        ) : (
          <p className="flex flex-1 items-center justify-center rounded-3xl bg-surface-raised text-center text-sm text-ink-secondary shadow-e2">
            No operating office has scored yet.
          </p>
        )}

        <ol className="flex shrink-0 flex-col gap-2">
          {rest.map((entry, index) => (
            <Rise
              key={String(entry.officeId)}
              delay={0.12 + index * 0.05}
              className="flex items-center gap-5 rounded-2xl bg-surface-raised px-6 py-3 shadow-e1"
            >
              <span className="tabular w-8 text-xl font-bold text-ink-faint">{entry.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[17px] font-semibold text-ink">
                  {entry.officeName}
                </span>
                <span className="block text-xs text-ink-muted">
                  {entry.memberCount} member{entry.memberCount === 1 ? "" : "s"}
                </span>
              </span>
              <span className="hidden gap-5.5 sm:flex">
                {[entry.aplCount, entry.apdCount, entry.reCount].map((count, position) => (
                  <span
                    key={position}
                    className="tabular w-8.5 text-right text-[15px] font-semibold text-ink-secondary"
                  >
                    {count}
                  </span>
                ))}
              </span>
              <span className="tabular w-15 text-right text-[22px] font-bold text-ink">
                {entry.points}
              </span>
            </Rise>
          ))}
        </ol>
      </div>

    </main>
  );
}

function StageTile({
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
    <span className={`block rounded-[11px] px-4 py-2 ${wash}`}>
      <span className={`tabular block text-[17px] font-bold ${ink}`}>{value}</span>
      <span className={`block text-[10px] font-bold tracking-[0.06em] ${ink}`}>{label}</span>
    </span>
  );
}

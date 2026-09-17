import { requireMemberPage } from "@/lib/auth/guards";
import { individualStandings, officeStandings } from "@/lib/leaderboard";

import { ContactShadow } from "@/components/studio/character";
import { CharacterGroup } from "@/components/studio/character-group";
import { memberAvatars } from "@/lib/design/avatar";
import { characterFor } from "@/lib/design/character";
import { Dock } from "@/components/studio/dock";
import { GhostNumber, Rise } from "@/components/studio/motion";
import { Crown } from "@/components/studio/podium";

export const dynamic = "force-dynamic";

export default async function LcLeaderboardPage() {
  await requireMemberPage("/leaderboard/lcs");
  const [standings, members] = await Promise.all([officeStandings(), individualStandings()]);

  const [leader, ...rest] = standings;

  // The three bodies on the leading LC's plinth are its own top three, so the
  // group on the page is the group that put it there rather than decoration.
  const top = leader
    ? members.filter((standing) => standing.officeId === leader.officeId).slice(0, 3)
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
    <main className="flex min-h-dvh flex-col bg-wall">
      <div className="flex justify-end px-6 pt-8 sm:px-11">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
          {standings.length} entit{standings.length === 1 ? "y" : "ies"} · {totalMembers} members
        </p>
      </div>

      <div className="px-6 pt-7 text-center sm:px-11">
        <h1 className="font-display text-[28px] font-semibold text-ink">Local Committees</h1>
        <p className="mt-1.5 text-[13px] text-ink-muted">
          Each member counts once, for the office of their highest active position.
        </p>
      </div>

      {leader ? (
        <Rise
          delay={0.08}
          className="relative mx-6 mt-7 flex flex-col items-center overflow-hidden rounded-3xl bg-surface-raised px-10 pb-8 pt-11 shadow-e2 sm:mx-16"
        >
          <div className="absolute inset-x-0 top-[-18px]">
            <GhostNumber>{Math.round(leader.points)}</GhostNumber>
          </div>

          <Crown />

          {/* One canvas for the three, so they stand beside each other instead
              of in three overlapping boxes -- and can turn towards each other. */}
          <div className="relative z-10 mt-6 h-[230px] w-full">
            <CharacterGroup
              members={[
                ...(faces[1]
                  ? [{ id: faces[1].characterId ?? characterFor(faces[1].name).id, name: faces[1].name, offset: -1, scale: 0.82 }]
                  : []),
                ...(faces[0]
                  ? [{ id: faces[0].characterId ?? characterFor(faces[0].name).id, name: faces[0].name, offset: 0 }]
                  : []),
                ...(faces[2]
                  ? [{ id: faces[2].characterId ?? characterFor(faces[2].name).id, name: faces[2].name, offset: 1, scale: 0.82 }]
                  : []),
              ]}
              heightFraction={0.72}
              floorFraction={0.06}
              spread={1.35}
              eager
            />
          </div>

          <ContactShadow width={260} height={30} opacity={0.16} className="-mt-3.5" />

          <div className="relative z-10 mt-3.5 text-center">
            <p className="font-display text-[22px] font-semibold text-ink">{leader.officeName}</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {leader.memberCount} member{leader.memberCount === 1 ? "" : "s"} · rank 1
            </p>
            <p className="tabular mt-2.5 text-[52px] font-bold leading-none text-ink">
              {leader.points}
            </p>

            <div className="mt-4 flex justify-center gap-2.5">
              <StageTile label="APL" value={leader.aplCount} wash="bg-apl-wash" ink="text-apl-ink" />
              <StageTile label="APD" value={leader.apdCount} wash="bg-apd-wash" ink="text-apd-ink" />
              <StageTile label="RE" value={leader.reCount} wash="bg-re-wash" ink="text-re-ink" />
            </div>
          </div>
        </Rise>
      ) : (
        <p className="py-20 text-center text-sm text-ink-secondary">
          No operating office has scored yet.
        </p>
      )}

      <ol className="flex flex-col gap-2.5 px-6 pb-2 pt-7 sm:px-16">
        {rest.map((entry, index) => (
          <Rise
            key={String(entry.officeId)}
            delay={0.12 + index * 0.05}
            className="flex items-center gap-5 rounded-2xl bg-surface-raised px-6 py-4 shadow-e1"
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

      <div className="sticky bottom-7 z-20 mt-6 flex justify-center px-6 pb-1">
        <Dock />
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

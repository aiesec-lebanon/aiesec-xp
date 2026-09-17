import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { individualStandings } from "@/lib/leaderboard";

import { CharacterAvatar } from "@/components/studio/character";
import { memberAvatars } from "@/lib/design/avatar";
import { Dock } from "@/components/studio/dock";
import { Lift, Rise } from "@/components/studio/motion";
import { Podium, type PodiumPlace } from "@/components/studio/podium";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ office?: string; page?: string }>;
}) {
  const user = await requireMemberPage("/leaderboard");
  const params = await searchParams;

  const offices = await db.office.findMany({
    where: { isOperating: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const selected =
    params.office && /^\d+$/.test(params.office) ? BigInt(params.office) : undefined;
  const standings = await individualStandings(selected);

  const rest = standings.slice(3);
  const pageCount = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const page = Math.min(
    pageCount,
    Math.max(1, params.page && /^\d+$/.test(params.page) ? Number(params.page) : 1)
  );
  const rows = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // One query for the podium and the page of rows together, so a leaderboard
  // shows each member as the character they picked rather than the one their
  // name happens to hash to.
  const top = standings.slice(0, 3);
  const characters = await memberAvatars(
    [...top, ...rows].map((standing) => ({
      id: standing.memberId,
      fullName: standing.fullName,
    })),
  );

  // The podium always shows the top three of whatever is being looked at, so a
  // filtered board still has a winner rather than three empty plinths.
  const places: PodiumPlace[] = top.map((standing) => ({
    rank: standing.rank as 1 | 2 | 3,
    name: standing.fullName,
    office: standing.officeName,
    points: standing.points,
    characterId: characters.get(standing.memberId)?.id,
  }));

  const href = (next: { office?: bigint; page?: number }) => {
    const query = new URLSearchParams();
    const office = "office" in next ? next.office : selected;
    if (office !== undefined) query.set("office", String(office));
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const search = query.toString();
    return search ? `/leaderboard?${search}` : "/leaderboard";
  };

  return (
    <main className="relative flex min-h-dvh flex-col bg-wall">
      <div className="bg-surface pb-12">
        <div className="flex justify-end px-6 pt-8 sm:px-11">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
            {standings.length} member{standings.length === 1 ? "" : "s"} · live
          </p>
        </div>

        <div className="mt-12 px-6 sm:px-11">
          {places.length > 0 ? (
            <Podium places={places} />
          ) : (
            <p className="py-16 text-center text-sm text-ink-secondary">
              Nobody is in scope for this filter yet.
            </p>
          )}
        </div>
      </div>

      <div className="h-0.5 bg-horizon" />

      <div className="flex-1 px-6 py-8 sm:px-16 lg:px-30">
        <Rise className="mb-5 flex flex-wrap items-center justify-between gap-5">
          <nav aria-label="Filter by office" className="flex flex-wrap gap-2">
            <Link
              href={href({ office: undefined, page: 1 })}
              aria-current={selected === undefined ? "true" : undefined}
              className={`rounded-full px-4.5 py-2.5 text-[13px] transition-colors ${
                selected === undefined
                  ? "bg-ink font-semibold text-surface"
                  : "bg-surface-raised font-medium text-ink-secondary shadow-e1 hover:bg-surface-sunken"
              }`}
            >
              Everyone
            </Link>
            {offices.map((office) => (
              <Link
                key={String(office.id)}
                href={href({ office: office.id, page: 1 })}
                aria-current={selected === office.id ? "true" : undefined}
                className={`rounded-full px-4.5 py-2.5 text-[13px] transition-colors ${
                  selected === office.id
                    ? "bg-ink font-semibold text-surface"
                    : "bg-surface-raised font-medium text-ink-secondary shadow-e1 hover:bg-surface-sunken"
                }`}
              >
                {office.name}
              </Link>
            ))}
          </nav>

          <div
            aria-hidden
            className="hidden gap-6.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted sm:flex"
          >
            <span className="w-11 text-right">APL</span>
            <span className="w-11 text-right">APD</span>
            <span className="w-11 text-right">RE</span>
            <span className="w-[70px] text-right">Points</span>
          </div>
        </Rise>

        <ol className="flex flex-col gap-2">
          {rows.map((standing) => {
            const isSelf = standing.memberId === user.id;
            return (
              <Lift
                as="li"
                key={String(standing.memberId)}
                lift={-2}
                className={`flex items-center gap-5 rounded-2xl px-5.5 py-3 sm:gap-5 ${
                  isSelf ? "bg-ink shadow-e2" : "bg-surface-raised shadow-e1"
                }`}
              >
                <span
                  className={`tabular w-8.5 text-xl font-bold ${
                    isSelf ? "text-surface" : "text-ink-faint"
                  }`}
                >
                  {standing.rank}
                </span>
                <CharacterAvatar
                  name={standing.fullName}
                  idOverride={characters.get(standing.memberId)?.id}
                  size={46}
                  tone={isSelf ? "bg-[#2a2926]" : "bg-floor"}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[15px] font-semibold ${
                      isSelf ? "text-surface" : "text-ink"
                    }`}
                  >
                    {standing.fullName}
                    {isSelf ? (
                      <span className="ml-2 text-xs font-semibold text-apl-mid">you</span>
                    ) : null}
                  </span>
                  <span
                    className={`block text-xs ${isSelf ? "text-ink-faint" : "text-ink-secondary"}`}
                  >
                    {standing.officeName ?? "No office"}
                  </span>
                </span>

                {[standing.aplCount, standing.apdCount, standing.reCount].map((count, index) => (
                  <span
                    key={index}
                    className={`tabular hidden w-11 text-right text-base font-semibold sm:block ${
                      isSelf ? "text-ink-faint" : "text-ink-secondary"
                    }`}
                  >
                    {count}
                  </span>
                ))}

                <span
                  className={`tabular w-[70px] text-right text-[22px] font-bold ${
                    isSelf ? "text-surface" : "text-ink"
                  }`}
                >
                  {standing.points}
                </span>
              </Lift>
            );
          })}
        </ol>

        {pageCount > 1 ? (
          <div className="mt-4 flex items-center gap-2 px-1">
            <span className="mr-auto font-mono text-[10px] text-ink-faint">
              Ranks {(page - 1) * PER_PAGE + 4}–{Math.min(rest.length, page * PER_PAGE) + 3} of{" "}
              {standings.length}
            </span>
            <PageLink href={href({ page: page - 1 })} disabled={page === 1}>
              Prev
            </PageLink>
            <PageLink href={href({ page: page + 1 })} disabled={page === pageCount}>
              Next
            </PageLink>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-ink-faint">
          Ranked on points, then realizations, then approvals, then applications.
        </p>
      </div>

      <div className="sticky bottom-7 z-20 flex justify-center px-6 pb-1">
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

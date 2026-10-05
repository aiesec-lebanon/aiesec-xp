import Link from "next/link";

import { ROLE_SENIORITY } from "@/lib/auth/roles";
import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { officeLabel } from "@/lib/design/names";
import { mcDirectEntityId } from "@/lib/env";
import { individualStandings } from "@/lib/leaderboard";
import { resolveRange } from "@/lib/leaderboard-range";
import { loadCurrentWeights } from "@/lib/scoring/weight-periods";
import { termStart } from "@/lib/term";

import { CharacterAvatar } from "@/components/studio/character";
import { RollingNumber } from "@/components/studio/rolling-number";
import { memberAvatars } from "@/lib/design/avatar";
import { Lift, Rise } from "@/components/studio/motion";
import { PointsInfo, type PointsGuide } from "@/components/studio/points-info";
import { Podium, type PodiumPlace } from "@/components/studio/podium";
import { RangeFilter } from "@/components/studio/range-filter";

export const dynamic = "force-dynamic";

const PER_PAGE = 7;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    office?: string;
    page?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requireMemberPage("/leaderboard");
  const params = await searchParams;

  const [officeRows, floor, current] = await Promise.all([
    // isMc excluded: 182 is the query/country root, not a distinct filterable
    // entity -- filtering by it would just repeat "Everyone" (D-57), the same
    // reason it's excluded from the LC leaderboard's ranked rows.
    db.office.findMany({
      where: { isOperating: true, isMc: false },
      select: { id: true, name: true },
    }),
    termStart(),
    loadCurrentWeights(),
  ]);

  // MC-direct's committee (D-57) gets no chip: only LCs are filterable (D-84).
  const directEntityId = mcDirectEntityId();
  const offices = officeRows
    .filter((office) => office.id !== directEntityId)
    .map((office) => ({ id: office.id, label: officeLabel(office.name) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Unfiltered is the whole term to today (D-58), not the active display
  // window: the window is the reward race, this board is the record.
  const range = resolveRange(params, floor);

  const selected =
    params.office && /^\d+$/.test(params.office)
      ? BigInt(params.office)
      : undefined;
  const standings = (await individualStandings(range, selected)).filter(
    (standing) => standing.points > 0,
  );

  const rest = standings.slice(3);
  const pageCount = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const page = Math.min(
    pageCount,
    Math.max(
      1,
      params.page && /^\d+$/.test(params.page) ? Number(params.page) : 1,
    ),
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
    aplCount: standing.aplCount,
    apdCount: standing.apdCount,
    reCount: standing.reCount,
    characterId: characters.get(standing.memberId)?.id,
  }));

  const seniority = (role: string) => {
    const index = ROLE_SENIORITY.indexOf(role);
    return index === -1 ? ROLE_SENIORITY.length : index;
  };
  const guide: PointsGuide | null = current && {
    periodLabel: current.label,
    aplPoints: current.config.aplPoints,
    apdPoints: current.config.apdPoints,
    rePoints: current.config.rePoints,
    productWeights: { ...current.config.productWeights },
    directionWeights: { ...current.config.directionWeights },
    roleShares: Object.entries(current.config.roleShares)
      .filter(([, share]) => share > 0)
      .sort(([a], [b]) => seniority(a) - seniority(b) || a.localeCompare(b))
      .map(([role, share]) => ({ role, share })),
  };

  // Every link carries the range, so changing office or turning a page does not
  // silently drop the dates being looked at.
  const href = (next: { office?: bigint; page?: number }) => {
    const query = new URLSearchParams();
    const office = "office" in next ? next.office : selected;
    if (office !== undefined) query.set("office", String(office));
    if (!range.isDefault) {
      query.set("from", range.from);
      query.set("to", range.to);
    }
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const search = query.toString();
    return search ? `/leaderboard?${search}` : "/leaderboard";
  };

  const chip = (active: boolean) =>
    `rounded-full px-4.5 py-2.5 text-[13px] transition-colors ${
      active
        ? "bg-ink font-semibold text-surface"
        : "bg-surface-raised font-medium text-ink-secondary shadow-e1 hover:bg-surface-sunken"
    }`;

  return (
    // flex-1 under the layout's header, and nothing here overflows it: at lg
    // and up the whole board is on screen with no page scroll at all. Below
    // that the two columns stack and only the row list scrolls, so the filters
    // and the dock stay put.
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-wall">
      <div className="shrink-0 bg-surface pb-3">
        <Rise className="flex flex-col gap-4 px-6 pt-2 sm:px-11">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <RangeFilter
              action="/leaderboard"
              from={range.from}
              to={range.to}
              min={range.floor}
              max={range.ceiling}
              keep={selected === undefined ? {} : { office: String(selected) }}
            />
            
            <div className="flex items-center gap-2">
              <nav aria-label="Filter by office" className="flex flex-wrap gap-2">
                <Link
                  href={href({ office: undefined, page: 1 })}
                  aria-current={selected === undefined ? "true" : undefined}
                  className={chip(selected === undefined)}
                >
                  Everyone
                </Link>
                {offices.map((office) => (
                  <Link
                    key={String(office.id)}
                    href={href({ office: office.id, page: 1 })}
                    aria-current={selected === office.id ? "true" : undefined}
                    className={chip(selected === office.id)}
                  >
                    {office.label}
                  </Link>
                ))}
              </nav>
              {guide ? <PointsInfo guide={guide} /> : null}
            </div>

            {/* <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
              {standings.length} member{standings.length === 1 ? "" : "s"}
              {range.to === range.ceiling ? " · live" : ""}
            </p> */}
          </div>
        </Rise>
      </div>

      <div className="h-0.5 shrink-0 bg-horizon" />

      {/* The split. Stacked below lg, because three bodies and ten rows side by
          side stop being readable long before a phone's width -- and there the
          column scrolls as one page, which is what a thumb expects. At lg the
          scrolling stops and everything is on screen at once. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-3 sm:px-11 lg:flex-row lg:gap-7 lg:overflow-hidden">
        <section className="h-[38vh] min-h-[280px] shrink-0 lg:h-auto lg:min-h-0 lg:w-[360px] xl:w-[440px] 2xl:w-[520px]">
          {places.length > 0 ? (
            <Podium places={places} />
          ) : (
            <p className="flex h-full items-center justify-center rounded-[26px] bg-surface-raised px-6 text-center text-sm text-ink-secondary shadow-e2">
              No members here yet.
            </p>
          )}
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-2">
          <Rise className="flex shrink-0 items-end justify-between gap-4 px-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {rest.length === 0
                ? "No one else on the board yet"
                : `Ranks ${(page - 1) * PER_PAGE + 4}–${Math.min(rest.length, page * PER_PAGE) + 3} of ${standings.length}`}
            </span>
            <div
              aria-hidden
              className="hidden gap-6.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted sm:flex"
            >
              <span className="w-11 text-right">APL</span>
              <span className="w-11 text-right">APD</span>
              <span className="w-11 text-right">RE</span>
              <span
                className="w-[70px] text-right"
                title="An EP shared by several members counts in each of their APL, APD and RE, and its points are split between them."
              >
                Points
              </span>
            </div>
          </Rise>

          {/* At lg the rows share the height they are given rather than each
              taking a fixed amount, so ten of them land exactly on the bottom
              of the column. The cap stops them becoming slabs on a tall
              monitor; the floor keeps the avatar from being squeezed out, and
              is why this scrolls rather than hides: on a window under about
              810px ten rows at their smallest still do not fit, and a row you
              cannot reach is worse than a scrollbar on one column. */}
          <ol className="flex flex-col gap-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {rows.map((standing) => {
              const isSelf = standing.memberId === user.id;
              return (
              <Lift
                as="li"
                key={String(standing.memberId)}
                lift={-2}
                layout
                className={`flex min-h-[44px] items-center gap-4 rounded-2xl px-4 sm:gap-5 sm:px-5.5 lg:max-h-[62px] lg:flex-1 lg:basis-0 ${
                  isSelf ? "bg-ink shadow-e2" : "bg-surface-raised shadow-e1"
                }`}
              >
                <span
                  className={`tabular w-7 shrink-0 text-lg font-bold ${
                    isSelf ? "text-surface" : "text-ink-faint"
                  }`}
                >
                  <RollingNumber value={standing.rank} />
                </span>
                <CharacterAvatar
                  name={standing.fullName}
                  idOverride={characters.get(standing.memberId)?.id}
                  size={36}
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
                      <span className="ml-2 text-xs font-semibold text-apl-mid">
                        you
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`block text-xs ${isSelf ? "text-ink-faint" : "text-ink-secondary"}`}
                  >
                    {standing.officeName ?? "No LC"}
                  </span>
                </span>

                {[standing.aplCount, standing.apdCount, standing.reCount].map(
                  (count, index) => (
                    <span
                      key={index}
                      className={`tabular hidden w-11 text-right text-base font-semibold sm:block ${
                        isSelf ? "text-ink-faint" : "text-ink-secondary"
                      }`}
                    >
                      <RollingNumber value={count} />
                    </span>
                  ),
                )}

                <span
                  className={`tabular w-[70px] text-right text-[22px] font-bold ${
                    isSelf ? "text-surface" : "text-ink"
                  }`}
                >
                  <RollingNumber value={standing.points} />
                </span>
              </Lift>
            );
          })}
          </ol>

          <div className="flex shrink-0 items-center gap-2 px-1.5">
            <span className="mr-auto font-mono text-[10px] text-ink-faint">
              {pageCount > 1
                ? `Page ${page} of ${pageCount} · ${PER_PAGE} per page`
                : ""}
            </span>
            {pageCount > 1 ? (
              <>
                <PageLink href={href({ page: page - 1 })} disabled={page === 1}>
                  Previous
                </PageLink>
                <PageLink
                  href={href({ page: page + 1 })}
                  disabled={page === pageCount}
                >
                  Next
                </PageLink>
              </>
            ) : null}
          </div>
        </section>
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
    <Link
      href={href}
      className={`${className} transition-colors hover:bg-surface-sunken`}
    >
      {children}
    </Link>
  );
}

import Link from "next/link";

import { requireMemberPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { officeLabel } from "@/lib/design/names";
import { mcDirectEntityId } from "@/lib/env";
import { individualStandings } from "@/lib/leaderboard";
import { resolveRange } from "@/lib/leaderboard-range";
import { termStart } from "@/lib/term";

import { CharacterAvatar } from "@/components/studio/character";
import { RollingNumber } from "@/components/studio/rolling-number";
import { memberAvatars } from "@/lib/design/avatar";
import { Lift, Rise } from "@/components/studio/motion";
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

  const [officeRows, floor] = await Promise.all([
    // The MC is the country root; filtering by it would just repeat "Everyone".
    db.office.findMany({
      where: { isOperating: true, isMc: false },
      select: { id: true, name: true },
    }),
    termStart(),
  ]);

  // Only LCs are filterable, so MC-direct's committee gets no chip.
  const directEntityId = mcDirectEntityId();
  const offices = officeRows
    .filter((office) => office.id !== directEntityId)
    .map((office) => ({ id: office.id, label: officeLabel(office.name) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Unfiltered is the whole term to today, not the active display window.
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

  const top = standings.slice(0, 3);
  const characters = await memberAvatars(
    [...top, ...rows].map((standing) => ({
      id: standing.memberId,
      fullName: standing.fullName,
    })),
  );

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
          </div>
        </Rise>
      </div>

      <div className="h-0.5 shrink-0 bg-horizon" />

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

          {/* Rows share the column height at lg; their min height means short windows scroll. */}
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

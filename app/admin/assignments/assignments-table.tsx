"use client";

import { useMemo, useState } from "react";

import { CharacterAvatar } from "@/components/studio/character";
import { MultiSelect, type MultiOption } from "@/components/studio/multi-select";
import { SearchSelect, type SearchOption } from "@/components/studio/search-select";
import { FUNNEL_STATUSES } from "@/lib/admin/ep-order";

import { RunJobButton } from "../run-job-button";
import { AddManagerForm, CreditToggle, MakeMainButton } from "./controls";

// D-04: the products in scope.
const PROGRAMMES: Record<number, string> = { 7: "GV", 8: "GTa", 9: "GTe" };

const STATUS_TONE: Record<string, string> = {
  applied: "bg-apl-wash text-apl-ink",
  accepted: "bg-apl-wash text-apl-ink",
  approved: "bg-apd-wash text-apd-ink",
  realized: "bg-re-wash text-re-ink",
  remote_realized: "bg-re-wash text-re-ink",
  finished: "bg-re-wash text-re-ink",
  completed: "bg-re-wash text-re-ink",
  deleted: "bg-break-wash text-break-ink",
  approval_broken: "bg-break-wash text-break-ink",
  realization_broken: "bg-break-wash text-break-ink",
  remote_realization_broken: "bg-break-wash text-break-ink",
};
const NEUTRAL_TONE = "bg-surface-sunken text-ink-secondary";

function statusLabel(status: string): string {
  const words = status.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// EXPA's funnel order, so the filter reads top to bottom; anything else EXPA
// reports (withdrawn, broken, deleted) follows, alphabetically.
function statusRank(status: string): number {
  const index = (FUNNEL_STATUSES as readonly string[]).indexOf(status);
  return index === -1 ? FUNNEL_STATUSES.length : index;
}

const CHIP = "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.04em]";

const ALL = "ALL";
const NOBODY = "NOBODY";
const UNKNOWN = "UNKNOWN";

export type CreditSource = "EXPA" | "SHEET" | "ADMIN";

const SOURCE_LABEL: Record<CreditSource, string> = { EXPA: "EXPA", SHEET: "Sheet", ADMIN: "Added here" };

export type ManagerChip = {
  memberId: string;
  fullName: string;
  /** The member's saved character, so their portrait matches everywhere else (D-51). */
  characterId: string | null;
  /**
   * active: earns a share of the EP's points. removed: an admin took the credit
   * away, and no sync gives it back. pending: EXPA names a member the next
   * refresh will credit. outside: EXPA names someone who isn't a member this
   * term, who can't be credited.
   */
  state: "active" | "removed" | "pending" | "outside";
  /** The EP's main manager (D-83), who takes the full points. */
  isMain: boolean;
  sources: CreditSource[];
  /** Fraction of each of the EP's events this member takes, when more than one is on it. */
  share: number | null;
  role: string | null;
};

export type MemberOption = { id: string; fullName: string; role: string | null };

export type AssignmentRow = {
  epPersonId: string;
  fullName: string | null;
  lastActionLabel: string | null;
  signedUpLabel: string | null;
  /** Products of live applications; empty for a sign-up (D-72). */
  products: number[];
  /** What EXPA says, never behind the EP's applications (D-78); null when unread. */
  status: string | null;
  managers: ManagerChip[];
};

const PER_PAGE = 10;

/** Rows arrive newest last action first; filtering keeps that order. */
export function AssignmentsTable({
  rows: allRows,
  members,
  refreshed,
  since,
}: {
  rows: AssignmentRow[];
  members: MemberOption[];
  /** When EP data was last refreshed, e.g. "Last refreshed 4 min ago". */
  refreshed: string;
  /** When the current window opened: the table lists EPs updated since (D-76). */
  since: string;
}) {
  const [q, setQ] = useState("");
  const [product, setProduct] = useState(ALL);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [manager, setManager] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [page, setPage] = useState(1);

  const hasFilters = q !== "" || product !== ALL || statuses.length > 0 || manager !== ALL || source !== ALL;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return allRows.filter((row) => {
      if (product !== ALL && !row.products.includes(Number(product))) return false;

      if (statuses.length > 0 && !statuses.includes(row.status ?? UNKNOWN)) return false;

      const earning = row.managers.filter((chip) => chip.state === "active");
      if (manager === NOBODY && earning.length > 0) return false;
      if (manager !== ALL && manager !== NOBODY && !earning.some((chip) => chip.memberId === manager)) {
        return false;
      }

      if (source !== ALL && !earning.some((chip) => chip.sources.includes(source as CreditSource))) {
        return false;
      }

      if (needle) {
        const haystack = [row.epPersonId, row.fullName, ...row.managers.map((chip) => chip.fullName)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [allRows, q, product, statuses, manager, source]);

  const statusOptions = useMemo<MultiOption[]>(() => {
    const known = [...new Set(allRows.flatMap((row) => (row.status ? [row.status] : [])))]
      .sort((a, b) => statusRank(a) - statusRank(b) || a.localeCompare(b))
      .map((value) => ({ value, label: statusLabel(value) }));
    return allRows.some((row) => row.status === null)
      ? [...known, { value: UNKNOWN, label: "Unknown" }]
      : known;
  }, [allRows]);

  const managerOptions = useMemo<SearchOption[]>(() => {
    const earning = new Map<string, ManagerChip>();
    for (const row of allRows) {
      for (const chip of row.managers) if (chip.state === "active") earning.set(chip.memberId, chip);
    }
    return [
      { value: ALL, label: "All managers" },
      { value: NOBODY, label: "No one earning points" },
      ...[...earning.values()]
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .map((chip) => ({ value: chip.memberId, label: chip.fullName, hint: chip.role ?? undefined })),
    ];
  }, [allRows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const clampedPage = Math.min(page, pageCount);
  const shown = rows.slice((clampedPage - 1) * PER_PAGE, clampedPage * PER_PAGE);

  function filterBy<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }

  function clearFilters() {
    setQ("");
    setProduct(ALL);
    setStatuses([]);
    setManager(ALL);
    setSource(ALL);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
            EPs ({rows.length})
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            EPs with activity since {since}, newest first. {refreshed}.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <RunJobButton job="events" label="Refresh from EXPA" pendingLabel="Refreshing…" />
          <span className="font-mono text-[11px] text-ink-faint">
            Page {clampedPage} of {pageCount}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
        <input
          type="search"
          value={q}
          onChange={(event) => filterBy(setQ)(event.target.value)}
          placeholder="Search by EP name, EP ID or manager"
          aria-label="Search EPs"
          className={`${FIELD} w-full min-w-0 xl:w-56 xl:flex-1`}
        />

        <select
          value={product}
          onChange={(event) => filterBy(setProduct)(event.target.value)}
          aria-label="Product"
          className={`${FIELD} xl:w-auto`}
        >
          <option value={ALL}>All products</option>
          {Object.entries(PROGRAMMES).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>

        <MultiSelect
          label="Status"
          allLabel="All statuses"
          options={statusOptions}
          value={statuses}
          onChange={filterBy(setStatuses)}
          className="w-full sm:w-44 xl:flex-none"
        />

        <SearchSelect
          label="Manager"
          options={managerOptions}
          value={manager}
          onChange={filterBy(setManager)}
          searchPlaceholder="Search managers…"
          emptyText="No manager matches"
          className="w-full sm:w-56 xl:w-52 xl:flex-none"
        />

        <select
          value={source}
          onChange={(event) => filterBy(setSource)(event.target.value)}
          aria-label="Source"
          className={`${FIELD} xl:w-auto`}
        >
          <option value={ALL}>All sources</option>
          <option value="EXPA">From EXPA</option>
          <option value="SHEET">From the sign-up sheet</option>
          <option value="ADMIN">Added here</option>
        </select>

        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="whitespace-nowrap rounded-[10px] border border-line bg-surface-raised px-3.5 py-2 text-[13px] font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="grid grid-cols-1 gap-4 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint lg:grid-cols-[minmax(200px,1fr)_minmax(0,1.6fr)_250px]">
          <span>EP</span>
          <span className="hidden lg:block">Earning points</span>
          <span className="hidden lg:block">Add a manager</span>
        </div>

        {shown.map((row) => (
          <EpRow key={row.epPersonId} row={row} members={members} />
        ))}

        {rows.length === 0 ? (
          <p className="px-3.5 py-6 text-[13px] text-ink-secondary">
            {allRows.length === 0
              ? `No EP has signed up or had any activity since ${since}.`
              : "No EP matches these filters. Try clearing them."}
          </p>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-1.5 pt-1">
          <PageButton onClick={() => setPage((p) => p - 1)} disabled={clampedPage === 1}>
            Previous
          </PageButton>
          {pageNumbers(clampedPage, pageCount).map((entry, index) =>
            entry === "…" ? (
              <span key={`gap-${index}`} className="px-1 font-mono text-xs text-ink-faint">
                …
              </span>
            ) : (
              <PageButton
                key={entry}
                onClick={() => setPage(entry)}
                disabled={false}
                current={entry === clampedPage}
              >
                {entry}
              </PageButton>
            )
          )}
          <PageButton onClick={() => setPage((p) => p + 1)} disabled={clampedPage === pageCount}>
            Next
          </PageButton>
        </div>
      ) : null}
    </div>
  );
}

const FIELD = "rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink";

function EpRow({ row, members }: { row: AssignmentRow; members: MemberOption[] }) {
  const { epPersonId, fullName, lastActionLabel, signedUpLabel, products, status, managers } = row;
  const earning = managers.filter((chip) => chip.state === "active");

  const addable = useMemo<SearchOption[]>(() => {
    const taken = new Set(managers.filter((chip) => chip.state === "active").map((chip) => chip.memberId));
    return members
      .filter((member) => !taken.has(member.id))
      .map((member) => ({ value: member.id, label: member.fullName, hint: member.role ?? undefined }));
  }, [members, managers]);

  return (
    <div className="grid grid-cols-1 items-start gap-3 rounded-2xl px-3.5 py-3 transition-colors hover:bg-surface lg:grid-cols-[minmax(200px,1fr)_minmax(0,1.6fr)_250px] lg:gap-4">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-ink">
          {fullName ?? <span className="text-ink-faint">Name unavailable</span>}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="tabular font-mono text-[11px] text-ink-faint">{epPersonId}</span>
          {lastActionLabel ?? signedUpLabel ? (
            <span className="tabular font-mono text-[11px] text-ink-faint" title={signedUpLabel ?? undefined}>
              · {lastActionLabel ?? signedUpLabel}
            </span>
          ) : null}
          {products.map((programmeId) => (
            <span key={programmeId} className={`${CHIP} bg-surface-sunken text-ink-secondary`}>
              {PROGRAMMES[programmeId] ?? `Product ${programmeId}`}
            </span>
          ))}
          {status ? (
            <span className={`${CHIP} ${STATUS_TONE[status] ?? NEUTRAL_TONE}`}>{statusLabel(status)}</span>
          ) : null}
        </span>
      </span>

      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        {earning.length === 0 ? (
          <span className="py-1 text-sm font-semibold text-break-ink">No one earning points</span>
        ) : null}
        {managers.map((chip) => (
          <Manager key={chip.memberId} chip={chip} epPersonId={epPersonId} epName={fullName} />
        ))}
      </span>

      <AddManagerForm epPersonId={epPersonId} epName={fullName} options={addable} />
    </div>
  );
}

function Manager({ chip, epPersonId, epName }: { chip: ManagerChip; epPersonId: string; epName: string | null }) {
  const muted = chip.state !== "active";
  const note =
    chip.isMain && chip.state === "outside"
      ? "Main manager, but no longer a member, so nobody gets the full points. Make someone else main, or remove them."
      : chip.state === "removed"
        ? "Removed here. Refreshing won't add them back."
        : chip.state === "pending"
          ? "Manager in EXPA. Starts earning points at the next refresh."
          : chip.state === "outside"
            ? "Not a member this term, so can't earn points"
            : chip.isMain
              ? "Main manager: gets the full points and counts each stage as 1."
              : chip.role
                ? `${chip.role}${chip.share !== null ? `, gets ${Math.round(chip.share * 100)}% of this EP's points` : ""}`
                : undefined;

  return (
    <span
      title={note}
      className={`flex max-w-full items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1.5 ${
        muted ? "bg-surface-sunken/60" : "bg-surface-sunken"
      }`}
    >
      {chip.state === "outside" ? (
        <span aria-hidden className="grid size-6 flex-none place-items-center rounded-full bg-surface text-[10px] font-bold text-ink-faint">
          {chip.fullName.charAt(0).toUpperCase()}
        </span>
      ) : (
        <span className={muted ? "opacity-50 grayscale" : ""}>
          <CharacterAvatar
            name={chip.fullName}
            idOverride={chip.characterId ?? undefined}
            size={24}
            rounded="rounded-full"
          />
        </span>
      )}

      <span
        className={`truncate text-[13px] font-semibold ${
          chip.state === "removed" ? "text-ink-faint line-through" : muted ? "text-ink-faint" : "text-ink"
        }`}
      >
        {chip.fullName}
      </span>

      {chip.share !== null ? (
        <span className="tabular font-mono text-[11px] font-bold text-ink-secondary">
          {Math.round(chip.share * 100)}%
        </span>
      ) : null}

      {chip.isMain ? <span className={`${CHIP} bg-apd-wash text-apd-ink`}>Main</span> : null}

      {chip.sources.map((source) => (
        <span
          key={source}
          className={`${CHIP} ${source === "ADMIN" ? "bg-apl-wash text-apl-ink" : "bg-surface text-ink-secondary"}`}
        >
          {SOURCE_LABEL[source]}
        </span>
      ))}

      {chip.state === "pending" ? <span className={`${CHIP} bg-surface text-ink-faint`}>From next refresh</span> : null}
      {chip.state === "outside" ? <span className={`${CHIP} bg-surface text-ink-faint`}>Not a member</span> : null}

      {chip.state === "active" && !chip.isMain ? (
        <MakeMainButton epPersonId={epPersonId} epName={epName} memberId={chip.memberId} fullName={chip.fullName} />
      ) : null}

      {chip.state === "active" || chip.state === "pending" || (chip.isMain && chip.state === "outside") ? (
        <CreditToggle kind="remove" epPersonId={epPersonId} epName={epName} memberId={chip.memberId} fullName={chip.fullName} />
      ) : chip.state === "removed" ? (
        <CreditToggle kind="restore" epPersonId={epPersonId} epName={epName} memberId={chip.memberId} fullName={chip.fullName} />
      ) : null}
    </span>
  );
}

/**
 * Which page buttons to show around the current one, with a gap marker where
 * a run of pages is skipped -- always first, last and the current page's
 * immediate neighbours, so a jump never needs more than one click either way.
 */
function pageNumbers(current: number, total: number): (number | "…")[] {
  const window = new Set([1, total, current, current - 1, current + 1]);
  const pages = [...window].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  for (const [index, page] of pages.entries()) {
    if (index > 0 && page - pages[index - 1] > 1) result.push("…");
    result.push(page);
  }
  return result;
}

function PageButton({
  onClick,
  disabled,
  current = false,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  current?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={current ? "page" : undefined}
      className={`rounded-[9px] border px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
        current
          ? "border-ink bg-ink text-surface"
          : "border-line bg-surface-raised text-ink hover:bg-surface-sunken"
      }`}
    >
      {children}
    </button>
  );
}

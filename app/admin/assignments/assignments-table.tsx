"use client";

import { useMemo, useState } from "react";

import { CharacterAvatar } from "@/components/studio/character";

import { OverrideForm } from "./controls";

// D-04: the products in scope.
const PROGRAMMES: Record<number, string> = { 7: "GV", 8: "GTa", 9: "GTe" };

type EpStatus = "APL" | "APD" | "RE" | "BROKEN";

const STATUS_LABELS: Record<EpStatus, string> = {
  APL: "Applied",
  APD: "Approved",
  RE: "Realized",
  BROKEN: "Broken",
};

const STATUS_TONE: Record<EpStatus, string> = {
  APL: "bg-apl-wash text-apl-ink",
  APD: "bg-apd-wash text-apd-ink",
  RE: "bg-re-wash text-re-ink",
  BROKEN: "bg-break-wash text-break-ink",
};

const CHIP = "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.04em]";

const UNATTRIBUTED = "UNATTRIBUTED";
const ALL = "ALL";
const UNSCORED = "UNSCORED";

export type MemberOption = { id: string; fullName: string };
export type ManagerOption = { id: string; fullName: string };

export type AssignmentRow = {
  epPersonId: string;
  fullName: string | null;
  products: number[];
  status: EpStatus | null;
  creditedMemberId: string | null;
  creditedName: string | null;
  source: string | null;
  expaManagers: { id: string; fullName: string }[];
};

const PER_PAGE = 10;

export function AssignmentsTable({
  rows: allRows,
  members,
  managers,
}: {
  rows: AssignmentRow[];
  members: MemberOption[];
  managers: ManagerOption[];
}) {
  const [q, setQ] = useState("");
  const [product, setProduct] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [credited, setCredited] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [manager, setManager] = useState(ALL);
  const [page, setPage] = useState(1);

  const hasFilters =
    q !== "" || product !== ALL || status !== ALL || credited !== ALL || source !== ALL || manager !== ALL;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return allRows.filter((row) => {
      if (product !== ALL && !row.products.includes(Number(product))) return false;

      if (status !== ALL) {
        const rowStatus = row.status ?? UNSCORED;
        if (rowStatus !== status) return false;
      }

      if (credited !== ALL) {
        if (credited === UNATTRIBUTED) {
          if (row.creditedMemberId !== null) return false;
        } else if (row.creditedMemberId !== credited) {
          return false;
        }
      }

      if (source !== ALL && row.source !== source) return false;

      if (manager !== ALL && !row.expaManagers.some((m) => m.id === manager)) return false;

      if (needle) {
        const haystack = [
          row.epPersonId,
          row.fullName,
          row.creditedName,
          ...row.expaManagers.map((m) => m.fullName),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [allRows, q, product, status, credited, source, manager]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const clampedPage = Math.min(page, pageCount);
  const shown = rows.slice((clampedPage - 1) * PER_PAGE, clampedPage * PER_PAGE);

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setQ("");
    setProduct(ALL);
    setStatus(ALL);
    setCredited(ALL);
    setSource(ALL);
    setManager(ALL);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
          EPs with scored events ({rows.length})
        </h2>
        <span className="font-mono text-[11px] text-ink-faint">
          Page {clampedPage} of {pageCount}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
        <input
          type="search"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            resetPage();
          }}
          placeholder="Search EP name, EP id, credited to, manager…"
          className={`${FIELD} w-full min-w-0 xl:w-56 xl:flex-1`}
        />

        <select
          value={product}
          onChange={(event) => {
            setProduct(event.target.value);
            resetPage();
          }}
          className={`${FIELD} xl:w-auto`}
        >
          <option value={ALL}>All products</option>
          {Object.entries(PROGRAMMES).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetPage();
          }}
          className={`${FIELD} xl:w-auto`}
        >
          <option value={ALL}>All statuses</option>
          {(Object.entries(STATUS_LABELS) as [EpStatus, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          <option value={UNSCORED}>Unscored</option>
        </select>

        <select
          value={credited}
          onChange={(event) => {
            setCredited(event.target.value);
            resetPage();
          }}
          className={`${FIELD} xl:w-auto`}
        >
          <option value={ALL}>All members</option>
          <option value={UNATTRIBUTED}>Unattributed</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>

        <select
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            resetPage();
          }}
          className={`${FIELD} xl:w-auto`}
        >
          <option value={ALL}>All sources</option>
          <option value="SHEET">Sheet</option>
          <option value="ADMIN">Admin</option>
        </select>

        <select
          value={manager}
          onChange={(event) => {
            setManager(event.target.value);
            resetPage();
          }}
          className={`${FIELD} xl:w-auto`}
        >
          <option value={ALL}>All managers</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </select>

        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="whitespace-nowrap rounded-[10px] border border-line bg-surface-raised px-3.5 py-2 text-[13px] font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="grid grid-cols-[1fr_1fr] gap-4 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint xl:grid-cols-[minmax(200px,1.2fr)_1fr_130px_200px_220px]">
          <span>EP</span>
          <span>Credited to</span>
          <span className="hidden xl:block">Source</span>
          <span className="hidden xl:block">Manager in EXPA</span>
          <span className="hidden xl:block">Change</span>
        </div>

        {shown.map(
          ({ epPersonId: key, fullName, products, status: rowStatus, creditedName, source: rowSource, expaManagers }) => (
            <div
              key={key}
              className="grid grid-cols-[1fr_1fr] items-center gap-4 rounded-2xl px-3.5 py-3 transition-colors hover:bg-surface xl:grid-cols-[minmax(200px,1.2fr)_1fr_130px_200px_220px]"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-semibold text-ink">
                  {fullName ?? <span className="text-ink-faint">Name not in EXPA</span>}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular font-mono text-[11px] text-ink-faint">{key}</span>
                  {products.map((programmeId) => (
                    <span key={programmeId} className={`${CHIP} bg-surface-sunken text-ink-secondary`}>
                      {PROGRAMMES[programmeId] ?? `Programme ${programmeId}`}
                    </span>
                  ))}
                  {rowStatus ? (
                    <span className={`${CHIP} ${STATUS_TONE[rowStatus]}`}>{STATUS_LABELS[rowStatus]}</span>
                  ) : null}
                </span>
              </span>

              <span className="flex items-center gap-2.5">
                {creditedName ? (
                  <CharacterAvatar name={creditedName} size={32} rounded="rounded-[11px]" />
                ) : null}
                <span className={`text-sm font-semibold ${creditedName ? "text-ink" : "text-break-ink"}`}>
                  {creditedName ?? "Unattributed"}
                </span>
              </span>

              <span className="hidden xl:block">
                <SourceTag source={rowSource} />
              </span>

              <span className="hidden text-[13px] text-ink-secondary xl:block">
                {expaManagers.length > 0 ? expaManagers.map((m) => m.fullName).join(", ") : "—"}
              </span>

              <span className="col-span-2 xl:col-span-1">
                <OverrideForm epPersonId={key} members={members} />
              </span>
            </div>
          )
        )}

        {rows.length === 0 ? (
          <p className="px-3.5 py-6 text-[13px] text-ink-secondary">
            {allRows.length === 0
              ? "No EP has a scored event yet, so there is nothing to attribute."
              : "No EP matches these filters."}
          </p>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <PageButton onClick={() => setPage((p) => p - 1)} disabled={clampedPage === 1}>
            Prev
          </PageButton>
          <PageButton onClick={() => setPage((p) => p + 1)} disabled={clampedPage === pageCount}>
            Next
          </PageButton>
        </div>
      ) : null}
    </div>
  );
}

const FIELD = "rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink";

function SourceTag({ source }: { source: string | null }) {
  if (!source) {
    return <span className="text-[13px] text-ink-faint">—</span>;
  }

  // An ADMIN correction survives re-import (D-45), so it is the one source a
  // reader has to be able to pick out of a column at a glance.
  const admin = source === "ADMIN";

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold tracking-[0.05em] ${
        admin ? "bg-apl-wash text-apl-ink" : "bg-surface-sunken text-ink-secondary"
      }`}
    >
      {source}
    </span>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[9px] border border-line bg-surface-raised px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-sunken disabled:opacity-40"
    >
      {children}
    </button>
  );
}

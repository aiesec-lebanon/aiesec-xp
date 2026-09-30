"use client";

import { useActionState, useMemo, useState } from "react";

import { saveRoleSharesAction, type ActionState } from "@/lib/admin/scoring-actions";
import { roundPercent, SHARE_FIELD_PREFIX, splitShares } from "@/lib/scoring/shares";
import { useActionToast } from "@/components/studio/toast";

const FIELD =
  "rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink";
const PRIMARY =
  "rounded-[10px] bg-stage-apl px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-apl-ink disabled:opacity-50";

export type RoleRow = { role: string; members: number; share: number };

function parseShare(raw: string): number {
  const value = Number(raw);
  return raw.trim() === "" || !Number.isFinite(value) ? 0 : value;
}

export function RoleSharesForm({ roles }: { roles: RoleRow[] }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(saveRoleSharesAction, null);
  useActionToast(state);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(roles.map((row) => [row.role, String(row.share)]))
  );

  const shares = useMemo(
    () => Object.fromEntries(Object.entries(values).map(([role, raw]) => [role, parseShare(raw)])),
    [values]
  );
  const total = roundPercent(Object.values(shares).reduce((sum, share) => sum + share, 0));
  const balanced = Math.abs(total - 100) < 0.001;

  // The two most-held roles, as the pair an admin most needs to see split.
  const example = useMemo(() => {
    const pair = [...roles].sort((a, b) => b.members - a.members || a.role.localeCompare(b.role)).slice(0, 2);
    if (pair.length < 2) return null;
    const split = splitShares(
      pair.map((row, index) => ({ memberId: BigInt(index + 1), role: row.role })),
      shares
    );
    return pair.map((row, index) => ({ role: row.role, percent: roundPercent((split.get(String(index + 1)) ?? 0) * 100) }));
  }, [roles, shares]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <div className="grid grid-cols-[1fr_110px_150px] gap-4 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          <span>Role</span>
          <span>Members</span>
          <span>Share of an EP</span>
        </div>

        {roles.map((row) => (
          <div
            key={row.role}
            className="grid grid-cols-[1fr_110px_150px] items-center gap-4 rounded-2xl px-3.5 py-2 transition-colors hover:bg-surface"
          >
            <label htmlFor={`share-${row.role}`} className="text-sm font-semibold text-ink">
              {row.role}
            </label>
            <span className="tabular text-[13px] text-ink-secondary">{row.members}</span>
            <span className="flex items-center gap-2">
              <input
                id={`share-${row.role}`}
                name={`${SHARE_FIELD_PREFIX}${row.role}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                value={values[row.role] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [row.role]: event.target.value }))}
                className={`${FIELD} w-24 tabular`}
              />
              <span className="text-[13px] text-ink-secondary">%</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-3.5 pt-4">
        <p className={`text-sm font-semibold ${balanced ? "text-ink" : "text-break-ink"}`}>
          Total <span className="tabular">{total}%</span>
          {balanced ? null : <span className="font-normal">. Shares need to add up to 100%.</span>}
        </p>

        {example && balanced ? (
          <p className="text-[13px] text-ink-secondary">
            For example, an EP shared between {example[0]!.role} and {example[1]!.role}: {example[0]!.role}{" "}
            <b className="tabular text-ink">{example[0]!.percent}%</b>, {example[1]!.role}{" "}
            <b className="tabular text-ink">{example[1]!.percent}%</b>.
          </p>
        ) : null}

        <div className="flex-1" />

        <button type="submit" disabled={pending || !balanced} className={PRIMARY}>
          {pending ? "Saving…" : "Save shares"}
        </button>
      </div>
    </form>
  );
}

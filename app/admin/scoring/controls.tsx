"use client";

import { useActionState, useMemo, useState } from "react";

import { saveRoleSharesAction, type ActionState } from "@/lib/admin/scoring-actions";
import { formatPoints } from "@/lib/design/points";
import { SHARE_FIELD_PREFIX } from "@/lib/scoring/shares";
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

export function RoleSharesForm({ roles, apdPoints }: { roles: RoleRow[]; apdPoints: number }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(saveRoleSharesAction, null);
  useActionToast(state);

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(roles.map((row) => [row.role, String(row.share)]))
  );

  const shares = useMemo(
    () => Object.fromEntries(Object.entries(values).map(([role, raw]) => [role, parseShare(raw)])),
    [values]
  );
  const valid = Object.values(shares).every((share) => share >= 0 && share <= 100);

  // The most-held role, as the one an admin most often sees beside a main.
  const example = useMemo(() => {
    const role = [...roles].sort((a, b) => b.members - a.members || a.role.localeCompare(b.role))[0];
    return role ? { role: role.role, points: (apdPoints * (shares[role.role] ?? 0)) / 100 } : null;
  }, [roles, shares, apdPoints]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <div className="grid grid-cols-[1fr_110px_150px] gap-4 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          <span>Role</span>
          <span>Members</span>
          <span>When not the main</span>
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
        {valid ? (
          example ? (
            <p className="text-[13px] text-ink-secondary">
              For example, for an approval worth {formatPoints(apdPoints)} points, the main manager gets{" "}
              <b className="tabular text-ink">{formatPoints(apdPoints)}</b> and a manager in the {example.role} role beside
              them gets <b className="tabular text-ink">{formatPoints(example.points)}</b>.
            </p>
          ) : null
        ) : (
          <p className="text-sm font-semibold text-break-ink">Each percentage needs to be from 0 to 100.</p>
        )}

        <div className="flex-1" />

        <button type="submit" disabled={pending || !valid} className={PRIMARY}>
          {pending ? "Saving…" : "Save shares"}
        </button>
      </div>
    </form>
  );
}

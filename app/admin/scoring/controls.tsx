"use client";

import { useActionState, useMemo, useState } from "react";

import { saveWeightsAction, type ActionState } from "@/lib/admin/scoring-actions";
import { formatPoints } from "@/lib/design/points";
import { DIRECTION_LABEL, PROGRAMME_LABEL } from "@/lib/scoring/labels";
import { SHARE_FIELD_PREFIX } from "@/lib/scoring/shares";
import { DIRECTION_FIELD_PREFIX, POINTS_FIELD, PRODUCT_FIELD_PREFIX } from "@/lib/scoring/weights";
import { useActionToast } from "@/components/studio/toast";

const FIELD =
  "rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink";
const PRIMARY =
  "rounded-[10px] bg-stage-apl px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-apl-ink disabled:opacity-50";

export type RoleRow = { role: string; members: number; share: number };

export type StageWeights = {
  aplPoints: number;
  apdPoints: number;
  rePoints: number;
  productWeights: Record<string, number>;
  directionWeights: Record<string, number>;
};

const STAGES = [
  { key: "aplPoints", label: "Application", tone: "text-stage-apl" },
  { key: "apdPoints", label: "Approval", tone: "text-stage-apd" },
  { key: "rePoints", label: "Realization", tone: "text-stage-re" },
] as const;

const HEADING = "text-xs font-bold uppercase tracking-[0.08em] text-ink-muted";

function parseShare(raw: string): number {
  const value = Number(raw);
  return raw.trim() === "" || !Number.isFinite(value) ? 0 : value;
}

function WeightInput({ id, name, label, defaultValue, tone }: {
  id: string;
  name: string;
  label: string;
  defaultValue: number;
  tone?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className={`text-[13px] font-semibold ${tone ?? "text-ink"}`}>{label}</span>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        required
        defaultValue={defaultValue}
        className={`${FIELD} w-28 tabular`}
      />
    </label>
  );
}

export function WeightsForm({ roles, weights }: { roles: RoleRow[]; weights: StageWeights }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(saveWeightsAction, null);
  useActionToast(state);
  const apdPoints = weights.apdPoints;

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
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className={`${HEADING} mb-3`}>Points per stage</legend>
        <div className="flex flex-wrap gap-6">
          {STAGES.map((stage) => (
            <WeightInput
              key={stage.key}
              id={`points-${stage.key}`}
              name={POINTS_FIELD[stage.key]}
              label={stage.label}
              defaultValue={weights[stage.key]}
              tone={stage.tone}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${HEADING} mb-3`}>Programme weights</legend>
        <div className="flex flex-wrap gap-6">
          {Object.entries(weights.productWeights).map(([id, value]) => (
            <WeightInput
              key={id}
              id={`product-${id}`}
              name={`${PRODUCT_FIELD_PREFIX}${id}`}
              label={PROGRAMME_LABEL[id] ?? `Programme ${id}`}
              defaultValue={value}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${HEADING} mb-3`}>Direction weights</legend>
        <div className="flex flex-wrap gap-6">
          {Object.entries(weights.directionWeights).map(([key, value]) => (
            <WeightInput
              key={key}
              id={`direction-${key}`}
              name={`${DIRECTION_FIELD_PREFIX}${key}`}
              label={DIRECTION_LABEL[key] ?? key}
              defaultValue={value}
            />
          ))}
        </div>
        <p className="text-[13px] text-ink-secondary">
          A stage is worth its points × its programme weight × its direction weight.
        </p>
      </fieldset>

      <h3 className={HEADING}>Shares by role</h3>
      <div className="-mt-4 flex flex-col gap-0.5">
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
          {pending ? "Saving…" : "Save points"}
        </button>
      </div>
    </form>
  );
}

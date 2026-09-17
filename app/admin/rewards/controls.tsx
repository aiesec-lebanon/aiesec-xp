"use client";

import { useActionState, type ReactNode } from "react";

import {
  deleteRewardAction,
  saveRewardAction,
  type ActionState,
} from "@/lib/admin/reward-actions";

const FIELD =
  "rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink";
const PRIMARY =
  "rounded-[10px] bg-stage-apl px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-apl-ink disabled:opacity-50";
const DANGER =
  "rounded-[10px] border border-break-ink px-4 py-2 text-[13px] font-semibold text-break-ink transition-colors hover:bg-break-wash disabled:opacity-50";

const THRESHOLD_LABEL: Record<string, string> = {
  POINTS: "Points",
  APL_COUNT: "APL count",
  APD_COUNT: "APD count",
  RE_COUNT: "RE count",
};

function Message({ state }: { state: ActionState | null }) {
  if (!state) return null;

  return (
    <p
      role="status"
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold ${
        state.ok ? "bg-apd-wash text-ink" : "bg-re-wash text-ink"
      }`}
    >
      <span
        aria-hidden
        className={`size-2 flex-none rounded-full ${state.ok ? "bg-stage-apd" : "bg-stage-re"}`}
      />
      {state.message}
    </p>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-ink-muted">
      {label}
      {children}
    </label>
  );
}

export type RewardFormValues = {
  id?: string;
  label: string;
  description: string;
  thresholdType: "POINTS" | "APL_COUNT" | "APD_COUNT" | "RE_COUNT";
  threshold: string;
  valueAmount: string;
  valueCurrency: string;
  iconKey: string;
  isActive: boolean;
  sortOrder: string;
};

export function RewardForm({
  values,
  submitLabel,
}: {
  values: RewardFormValues;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    saveRewardAction,
    null
  );

  return (
    <form action={action} className="flex flex-col gap-3.5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <div className="flex flex-wrap items-end gap-3.5">
        <Field label="Label">
          <input
            name="label"
            required
            defaultValue={values.label}
            className={`${FIELD} w-48`}
          />
        </Field>

        <Field label="Threshold type">
          <select name="thresholdType" defaultValue={values.thresholdType} className={FIELD}>
            {Object.entries(THRESHOLD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Threshold">
          <input
            name="threshold"
            type="number"
            min="0"
            step="any"
            required
            defaultValue={values.threshold}
            className={`${FIELD} w-24`}
          />
        </Field>

        <Field label="Value">
          <input
            name="valueAmount"
            type="number"
            min="0"
            step="any"
            defaultValue={values.valueAmount}
            className={`${FIELD} w-24`}
          />
        </Field>

        <Field label="Currency">
          <input name="valueCurrency" defaultValue={values.valueCurrency} className={`${FIELD} w-20`} />
        </Field>

        <Field label="Icon key">
          <input name="iconKey" defaultValue={values.iconKey} className={`${FIELD} w-32`} />
        </Field>

        <Field label="Sort">
          <input
            name="sortOrder"
            type="number"
            defaultValue={values.sortOrder}
            className={`${FIELD} w-16`}
          />
        </Field>

        <label className="flex items-center gap-1.5 pb-2 text-[13px] text-ink-secondary">
          <input type="checkbox" name="isActive" value="true" defaultChecked={values.isActive} />
          Active
        </label>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          defaultValue={values.description}
          rows={2}
          className={`${FIELD} w-full`}
        />
      </Field>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY}>
          {submitLabel}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function DeleteRewardButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    deleteRewardAction,
    null
  );

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={DANGER}
        onClick={(event) => {
          if (!confirm(`Remove ${label}? This deletes any grants it earned.`)) {
            event.preventDefault();
          }
        }}
      >
        Remove
      </button>
      <Message state={state} />
    </form>
  );
}

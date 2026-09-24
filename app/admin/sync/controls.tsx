"use client";

import { useActionState } from "react";

import { setHackathonModeAction, type ActionState } from "@/lib/admin/sync-actions";
import { DEFAULT_HACKATHON_HOURS, HACKATHON_HOURS } from "@/lib/sync/cadence";

const FIELD =
  "rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink";

const DURATION_LABEL: Record<(typeof HACKATHON_HOURS)[number], string> = {
  12: "12 hours",
  24: "1 day",
  48: "2 days",
  72: "3 days",
  168: "1 week",
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

/**
 * Flipping the switch is the whole action. How long it stays on is asked only
 * on the way on; the way off has nothing to choose.
 */
export function HackathonSwitch({ on }: { on: boolean }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    setHackathonModeAction,
    null
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <input type="hidden" name="enabled" value={on ? "false" : "true"} />
        <button
          type="submit"
          role="switch"
          aria-checked={on}
          aria-labelledby="hackathon-switch-label"
          aria-busy={pending}
          disabled={pending}
          className={`inline-flex h-7 w-12 flex-none items-center rounded-full border transition-colors disabled:opacity-50 ${
            on ? "border-transparent bg-stage-apd" : "border-line bg-surface-sunken"
          }`}
        >
          <span
            aria-hidden
            className={`size-5 rounded-full bg-white shadow-e1 transition-transform ${
              on ? "translate-x-[23px]" : "translate-x-[3px]"
            }`}
          />
        </button>
        <span id="hackathon-switch-label" className="text-sm font-semibold text-ink">
          Hackathon mode
        </span>

        {on ? null : (
          <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
            for
            <select
              name="hours"
              aria-label="How long hackathon mode stays on"
              defaultValue={String(DEFAULT_HACKATHON_HOURS)}
              className={FIELD}
            >
              {HACKATHON_HOURS.map((hours) => (
                <option key={hours} value={hours}>
                  {DURATION_LABEL[hours]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Message state={state} />
    </form>
  );
}

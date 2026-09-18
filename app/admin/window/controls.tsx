"use client";

import { useActionState } from "react";

import {
  setDisplayWindowAction,
  setTermStartAction,
  type ActionState,
} from "@/lib/admin/window-actions";

const FIELD =
  "rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink";
const PRIMARY =
  "rounded-[10px] bg-stage-apl px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-apl-ink disabled:opacity-50";

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

export function WindowForm({
  label,
  startsAt,
  endsAt,
}: {
  label: string;
  startsAt: string;
  endsAt: string;
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    setDisplayWindowAction,
    null
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="label" className="text-xs font-semibold text-ink-muted">
            Label
          </label>
          <input
            id="label"
            name="label"
            type="text"
            required
            defaultValue={label}
            className={`${FIELD} w-48`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="startsAt" className="text-xs font-semibold text-ink-muted">
            Starts
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="date"
            required
            defaultValue={startsAt}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="endsAt" className="text-xs font-semibold text-ink-muted">
            Ends (optional)
          </label>
          <input id="endsAt" name="endsAt" type="date" defaultValue={endsAt} className={FIELD} />
        </div>

        <button type="submit" disabled={pending} className={PRIMARY}>
          Save window
        </button>
      </div>

      <Message state={state} />
    </form>
  );
}

export function TermForm({ startsAt }: { startsAt: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    setTermStartAction,
    null
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="termStartsAt" className="text-xs font-semibold text-ink-muted">
            Term starts
          </label>
          <input
            id="termStartsAt"
            name="termStartsAt"
            type="date"
            required
            defaultValue={startsAt}
            className={FIELD}
          />
        </div>

        <button type="submit" disabled={pending} className={PRIMARY}>
          Save term start
        </button>
      </div>

      <Message state={state} />
    </form>
  );
}

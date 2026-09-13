"use client";

import { useActionState, useState } from "react";

import {
  mapAliasAction,
  overrideAssignmentAction,
  runImportAction,
  type ActionState,
} from "@/lib/admin/assignment-actions";

type MemberOption = { id: string; fullName: string };
type SuggestionOption = { memberId: string; fullName: string; reason: string };

function Message({ state }: { state: ActionState | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`text-sm ${state.ok ? "text-green-700" : "text-amber-800"}`}
    >
      {state.message}
    </p>
  );
}

export function ImportButtons() {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    runImportAction,
    null
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        name="commit"
        value="false"
        disabled={pending}
        className="rounded border px-3 py-2 text-sm"
      >
        Preview
      </button>
      <button
        type="submit"
        name="commit"
        value="true"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
      >
        Import
      </button>
      <Message state={state} />
    </form>
  );
}

/**
 * Mapping one sheet label to a member.
 *
 * Suggestions are offered but never pre-selected: the whole point of the alias
 * table is that a human decides which Ahmad was meant.
 */
export function AliasForm({
  label,
  rowCount,
  suggestions,
  members,
}: {
  label: string;
  rowCount: number;
  suggestions: SuggestionOption[];
  members: MemberOption[];
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(mapAliasAction, null);
  const [choice, setChoice] = useState("");

  // Shown when the label is already mapped elsewhere and the server asked for
  // confirmation before moving it.
  const needsConfirm = state !== null && !state.ok && state.message.includes("Confirm to move");

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="label" value={label} />

      <div className="flex flex-wrap items-baseline gap-2">
        <strong className="text-base">{label}</strong>
        <span className="text-sm text-neutral-500">{rowCount} row(s) in the sheets</span>
      </div>

      {suggestions.length > 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Suggested: {suggestions.map((s) => `${s.fullName} (${s.reason})`).join("; ")}
        </p>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No member matches this name. Pick one, or add them to the sheet under a name that matches.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`member-${label}`}>
          Member for {label}
        </label>
        <select
          id={`member-${label}`}
          name="memberId"
          required
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">Select a member</option>
          {suggestions.length > 0 ? (
            <optgroup label="Suggested">
              {suggestions.map((s) => (
                <option key={s.memberId} value={s.memberId}>
                  {s.fullName}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="All members">
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </optgroup>
        </select>

        {needsConfirm ? <input type="hidden" name="confirm" value="true" /> : null}

        <button type="submit" disabled={pending} className="rounded border px-3 py-1 text-sm">
          {needsConfirm ? "Confirm move" : "Map"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function OverrideForm({
  epPersonId,
  members,
}: {
  epPersonId: string;
  members: MemberOption[];
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    overrideAssignmentAction,
    null
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="epPersonId" value={epPersonId} />
      <label className="sr-only" htmlFor={`ep-${epPersonId}`}>
        Credit EP {epPersonId} to
      </label>
      <select
        id={`ep-${epPersonId}`}
        name="memberId"
        required
        defaultValue=""
        className="rounded border px-2 py-1 text-sm"
      >
        <option value="">Select</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.fullName}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="rounded border px-2 py-1 text-sm">
        Save
      </button>
      <Message state={state} />
    </form>
  );
}

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

const FIELD =
  "rounded-[10px] border border-line bg-surface-raised px-3 py-2 text-[13px] text-ink";
const PRIMARY =
  "rounded-[10px] bg-stage-apl px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-apl-ink disabled:opacity-50";
const SECONDARY =
  "rounded-[10px] border border-ink bg-surface-raised px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50";

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

export function ImportButtons() {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    runImportAction,
    null
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" name="commit" value="false" disabled={pending} className={SECONDARY}>
        Preview
      </button>
      <button type="submit" name="commit" value="true" disabled={pending} className={PRIMARY}>
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
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    mapAliasAction,
    null
  );
  const [choice, setChoice] = useState("");

  // Shown when the label is already mapped elsewhere and the server asked for
  // confirmation before moving it.
  const needsConfirm = state !== null && !state.ok && state.message.includes("Confirm to move");

  return (
    <form action={action} className="flex flex-wrap items-center gap-5">
      <input type="hidden" name="label" value={label} />

      <div className="min-w-40">
        <p className="text-base font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-muted">
          {rowCount} row{rowCount === 1 ? "" : "s"} in the sheets
        </p>
      </div>

      <p
        className={`min-w-55 flex-1 text-[13px] ${
          suggestions.length === 0 ? "text-break-ink" : "text-ink-secondary"
        }`}
      >
        {suggestions.length > 0
          ? `Suggested: ${suggestions
              .map((suggestion) => `${suggestion.fullName} (${suggestion.reason})`)
              .join("; ")}`
          : "No member matches this name. Pick one, or add them to the sheet under a name that matches."}
      </p>

      <label className="sr-only" htmlFor={`member-${label}`}>
        Member for {label}
      </label>
      <select
        id={`member-${label}`}
        name="memberId"
        required
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
        className={FIELD}
      >
        <option value="">Select a member</option>
        {suggestions.length > 0 ? (
          <optgroup label="Suggested">
            {suggestions.map((suggestion) => (
              <option key={suggestion.memberId} value={suggestion.memberId}>
                {suggestion.fullName}
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

      <button type="submit" disabled={pending} className={needsConfirm ? SECONDARY : PRIMARY}>
        {needsConfirm ? "Confirm move" : "Map"}
      </button>

      <Message state={state} />
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
        className={`${FIELD} min-w-0 flex-1 py-1.5 text-xs`}
      >
        <option value="">Select</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.fullName}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={`${SECONDARY} px-3 py-1.5 text-xs`}>
        Save
      </button>
      <Message state={state} />
    </form>
  );
}

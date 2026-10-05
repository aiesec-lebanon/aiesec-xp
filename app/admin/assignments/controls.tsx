"use client";

import { useActionState, useState } from "react";

import {
  addManagerAction,
  removeManagerAction,
  restoreManagerAction,
  setMainManagerAction,
  runImportAction,
  type ActionState,
} from "@/lib/admin/assignment-actions";
import { SearchSelect, type SearchOption } from "@/components/studio/search-select";
import { useActionToast } from "@/components/studio/toast";

const PRIMARY =
  "rounded-[10px] bg-stage-apl px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-apl-ink disabled:opacity-50";
const SECONDARY =
  "rounded-[10px] border border-ink bg-surface-raised px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50";

export function ImportButtons() {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    runImportAction,
    null
  );
  useActionToast(state);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" name="commit" value="false" disabled={pending} className={SECONDARY}>
        {pending ? "Checking…" : "Preview"}
      </button>
      <button type="submit" name="commit" value="true" disabled={pending} className={PRIMARY}>
        {pending ? "Importing…" : "Import now"}
      </button>
    </form>
  );
}

export function AddManagerForm({
  epPersonId,
  epName,
  options,
}: {
  epPersonId: string;
  epName: string | null;
  options: SearchOption[];
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    addManagerAction,
    null
  );
  useActionToast(state);
  const [memberId, setMemberId] = useState("");

  return (
    <form
      action={(formData) => {
        // Cleared on submit: once added, the member leaves this list, so the
        // choice would otherwise point at an option that no longer exists.
        setMemberId("");
        action(formData);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="epPersonId" value={epPersonId} />
      <input type="hidden" name="epName" value={epName ?? ""} />
      <SearchSelect
        name="memberId"
        label={`Add a manager to ${epName ?? `EP ${epPersonId}`}`}
        placeholder="Add a manager"
        searchPlaceholder="Search members…"
        emptyText="No member matches"
        options={options}
        value={memberId}
        onChange={setMemberId}
        className="min-w-0 flex-1"
        buttonClassName="py-1.5 text-xs"
      />
      <button
        type="submit"
        disabled={pending || memberId === ""}
        className={`${SECONDARY} px-3 py-1.5 text-xs`}
      >
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}

export function MakeMainButton({
  epPersonId,
  epName,
  memberId,
  fullName,
}: {
  epPersonId: string;
  epName: string | null;
  memberId: string;
  fullName: string;
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(setMainManagerAction, null);
  useActionToast(state);
  const label = `Make ${fullName} the main manager for ${epName ?? `EP ${epPersonId}`}`;

  return (
    <form action={action} className="flex">
      <input type="hidden" name="epPersonId" value={epPersonId} />
      <input type="hidden" name="epName" value={epName ?? ""} />
      <input type="hidden" name="memberId" value={memberId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={label}
        title={label}
        className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-apl-ink transition-colors hover:bg-apl-wash disabled:opacity-40"
      >
        {pending ? "…" : "Make main"}
      </button>
    </form>
  );
}

export function CreditToggle({
  kind,
  epPersonId,
  epName,
  memberId,
  fullName,
}: {
  kind: "remove" | "restore";
  epPersonId: string;
  epName: string | null;
  memberId: string;
  fullName: string;
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    kind === "remove" ? removeManagerAction : restoreManagerAction,
    null
  );
  useActionToast(state);

  const ep = epName ?? `EP ${epPersonId}`;
  const label = kind === "remove" ? `Remove ${fullName} from ${ep}` : `Let ${fullName} earn points for ${ep} again`;

  return (
    <form action={action} className="flex">
      <input type="hidden" name="epPersonId" value={epPersonId} />
      <input type="hidden" name="epName" value={epName ?? ""} />
      <input type="hidden" name="memberId" value={memberId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={label}
        title={label}
        className={
          kind === "remove"
            ? "grid size-5 place-items-center rounded-full text-[13px] leading-none text-ink-faint transition-colors hover:bg-break-wash hover:text-break-ink disabled:opacity-40"
            : "rounded-full px-2 py-0.5 text-[11px] font-semibold text-apl-ink transition-colors hover:bg-apl-wash disabled:opacity-40"
        }
      >
        {kind === "remove" ? "×" : pending ? "…" : "Restore"}
      </button>
    </form>
  );
}

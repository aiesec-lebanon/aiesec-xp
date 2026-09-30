"use client";

import { useActionState } from "react";

import { runSyncJobAction, type ActionState } from "@/lib/admin/sync-actions";
import type { SyncJobName } from "@/lib/sync/cadence";
import { useActionToast } from "@/components/studio/toast";

const SECONDARY =
  "whitespace-nowrap rounded-[10px] border border-ink bg-surface-raised px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50";

/** Runs a sync job now. Shared by the EP table's Refresh and the Sync page. */
export function RunJobButton({
  job,
  label,
  pendingLabel,
}: {
  job: SyncJobName;
  label: string;
  pendingLabel: string;
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(
    runSyncJobAction,
    null
  );
  useActionToast(state);

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-3">
      <input type="hidden" name="job" value={job} />
      <button type="submit" disabled={pending} aria-busy={pending} className={SECONDARY}>
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}

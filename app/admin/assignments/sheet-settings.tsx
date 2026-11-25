"use client";

import { useActionState, useState } from "react";

import { saveSignupSheet, type ActionState } from "@/lib/admin/sheet-actions";

import { useActionToast } from "@/components/studio/toast";

const FIELD =
  "min-h-9 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function SheetSettings({
  configured,
  tabName,
  managersTabName,
  serviceAccountEmail,
}: {
  configured: boolean;
  tabName: string;
  managersTabName: string;
  serviceAccountEmail: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(saveSignupSheet, null);
  const [open, setOpen] = useState(!configured);
  useActionToast(state);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[13px] font-semibold text-apl-ink underline-offset-2 hover:underline"
      >
        Change the sign-up sheet
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl bg-surface px-4 py-4">
      <p className="text-[13px] text-ink-secondary">
        {serviceAccountEmail ? (
          <>
            Share the sheet with <b className="text-ink">{serviceAccountEmail}</b> as Viewer and keep
            General access on Restricted. AIESEC XP reads only the EP ID, manager, LC and team
            columns.
          </>
        ) : (
          <>AIESEC XP isn&rsquo;t connected to Google Sheets yet. Ask the platform team to finish the set-up.</>
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-72 flex-1 flex-col gap-1 text-[13px] font-medium text-ink">
          Sheet link
          <input name="sheet" required placeholder="https://docs.google.com/spreadsheets/d/…" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
          EPs tab
          <input name="tabName" required defaultValue={tabName} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
          Managers tab
          <input name="managersTabName" required defaultValue={managersTabName} className={FIELD} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-9 rounded-full bg-ink px-5 text-[13px] font-semibold text-wall disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";

import {
  eraseRequester,
  linkPrivacyRequest,
  type PrivacyActionResult,
  setHiddenFromBoards,
  setPrivacyRequestStatus,
} from "@/lib/admin/privacy-actions";
import { replyMailto } from "@/lib/privacy/contact";

import { useToast } from "@/components/studio/toast";

const BUTTON =
  "min-h-9 rounded-full bg-surface-raised px-4 text-[13px] font-semibold text-ink shadow-e1 transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50";
const FIELD =
  "min-h-9 rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export type RequestRow = {
  id: string;
  status: string;
  memberId: string | null;
  memberName: string | null;
  hiddenFromBoards: boolean;
  replyEmail: string | null;
  message: string;
};

export function RequestControls({ row }: { row: RequestRow }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [expaId, setExpaId] = useState("");
  const [confirm, setConfirm] = useState("");
  const [erasing, setErasing] = useState(false);
  const open = row.status === "RECEIVED" || row.status === "IN_PROGRESS";

  function run(action: () => Promise<PrivacyActionResult>, done: string) {
    startTransition(async () => {
      const result = await action();
      toast(result.ok ? done : result.message, result.ok ? "ok" : "error");
    });
  }

  if (!open) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {row.replyEmail && (
          <a href={replyMailto(row.replyEmail, row.message)} className={`${BUTTON} inline-flex items-center`}>
            Reply by email
          </a>
        )}
        {row.status === "RECEIVED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setPrivacyRequestStatus(row.id, "IN_PROGRESS"), "Marked as started.")}
            className={BUTTON}
          >
            Start
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setPrivacyRequestStatus(row.id, "COMPLETED"), "Closed as done.")}
          className={BUTTON}
        >
          Mark done
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setPrivacyRequestStatus(row.id, "REFUSED"), "Closed as refused.")}
          className={BUTTON}
        >
          Refuse
        </button>
        {row.memberId && (
          <>
            <a href={`/api/admin/privacy/export?request=${row.id}`} className={`${BUTTON} inline-flex items-center`}>
              Download their data
            </a>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => setHiddenFromBoards(row.id, !row.hiddenFromBoards),
                  row.hiddenFromBoards ? "Back on the leaderboards." : "Taken off the leaderboards."
                )
              }
              className={BUTTON}
            >
              {row.hiddenFromBoards ? "Show on leaderboards again" : "Take off the leaderboards"}
            </button>
            <button type="button" disabled={pending} onClick={() => setErasing(true)} className={BUTTON}>
              Erase…
            </button>
          </>
        )}
      </div>

      {!row.memberId && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => linkPrivacyRequest(row.id, expaId), "Linked to the member.");
          }}
        >
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Once you have confirmed who sent this, link it to their EXPA ID
            <input
              value={expaId}
              onChange={(event) => setExpaId(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              className={FIELD}
            />
          </label>
          <button type="submit" disabled={pending} className={BUTTON}>
            Link
          </button>
        </form>
      )}

      {erasing && row.memberId && (
        <form
          className="flex flex-col gap-2 rounded-2xl bg-break-wash p-4 text-sm text-break-ink"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => eraseRequester(row.id, confirm), "Erased. Reply to let them know, then mark done.");
          }}
        >
          <p>
            This can&apos;t be undone. {row.memberName ?? "The member"}&apos;s record, points,
            rewards, character, credit and sign-ins are deleted, their name is removed from the
            change log, and XP stops reading them from EXPA.
          </p>
          <label className="flex flex-col gap-1 font-medium">
            Type ERASE to confirm
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="off"
              className={FIELD}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending || confirm !== "ERASE"} className={BUTTON}>
              Erase
            </button>
            <button type="button" onClick={() => setErasing(false)} className={BUTTON}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

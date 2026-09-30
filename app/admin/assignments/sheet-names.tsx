"use client";

import { useActionState, useState } from "react";

import {
  clearSheetMappingAction,
  saveSheetMappingAction,
  type ActionState,
} from "@/lib/admin/assignment-actions";
import { SearchSelect, type SearchOption } from "@/components/studio/search-select";
import { useActionToast } from "@/components/studio/toast";

export type SheetName = {
  name: string;
  lc: string;
  team: string;
  eps: number;
  status: "matched" | "unlisted" | "ambiguous" | "not-member";
  memberName: string | null;
  source: "SHEET" | "CONSOLE" | null;
  mappingId: string | null;
};

const STATUS: Record<SheetName["status"], { label: string; tone: string; hint: string }> = {
  matched: { label: "Matched", tone: "bg-apd-wash text-apd-ink", hint: "" },
  unlisted: {
    label: "Not matched",
    tone: "bg-break-wash text-break-ink",
    hint: "Not in the sheet's manager list yet. Choose who this is.",
  },
  ambiguous: {
    label: "More than one match",
    tone: "bg-break-wash text-break-ink",
    hint: "Several members have this name, and the LC and team don't settle it. Choose who this is.",
  },
  "not-member": {
    label: "Not a member",
    tone: "bg-re-wash text-re-ink",
    hint: "This EXPA ID doesn't belong to anyone with a member position this term.",
  },
};

const CHIP = "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.04em]";
const SECONDARY =
  "whitespace-nowrap rounded-[10px] border border-ink bg-surface-raised px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50";
const QUIET =
  "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-apl-ink transition-colors hover:bg-apl-wash disabled:opacity-40";

/** Every EP manager name the sign-up sheet uses, and who each one is. */
export function SheetNames({ names, members }: { names: SheetName[]; members: SearchOption[] }) {
  const [showMatched, setShowMatched] = useState(false);
  const open = names.filter((name) => name.status !== "matched");
  const matched = names.filter((name) => name.status === "matched");
  const shown = showMatched ? names : open;

  if (names.length === 0) {
    return <p className="text-[13px] text-ink-secondary">The sheet doesn&rsquo;t name any EP managers yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">
          {open.length === 0
            ? `All ${names.length} manager names are matched to a member`
            : `${open.length} of ${names.length} manager names need a member`}
        </h3>
        {matched.length > 0 ? (
          <button type="button" onClick={() => setShowMatched((value) => !value)} className={QUIET}>
            {showMatched ? "Show only names that need a member" : `Show all names (${names.length})`}
          </button>
        ) : null}
      </div>

      {shown.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {shown.map((name) => (
            <NameRow key={`${name.name}|${name.lc}|${name.team}`} name={name} members={members} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NameRow({ name, members }: { name: SheetName; members: SearchOption[] }) {
  const [changing, setChanging] = useState(false);
  const status = STATUS[name.status];
  const where = [name.lc, name.team].filter(Boolean).join(" · ");
  const picking = name.status !== "matched" || changing;

  return (
    <li className="grid grid-cols-1 items-center gap-2 rounded-2xl px-3.5 py-2.5 transition-colors hover:bg-surface lg:grid-cols-[minmax(180px,1fr)_minmax(0,1.3fr)_minmax(250px,auto)] lg:gap-4">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-ink">{name.name}</span>
        <span className="text-[11px] text-ink-faint">
          {where ? `${where} · ` : ""}
          {name.eps === 1 ? "1 EP" : `${name.eps} EPs`}
        </span>
      </span>

      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className={`${CHIP} ${status.tone}`}>{status.label}</span>
        {name.memberName && name.status !== "ambiguous" ? (
          <span className="truncate text-[13px] text-ink">{name.memberName}</span>
        ) : null}
        {name.status === "matched" ? (
          <span className="text-[11px] text-ink-faint">
            {name.source === "CONSOLE" ? "matched here" : "from the sheet's manager list"}
          </span>
        ) : (
          <span className="text-[11px] text-ink-secondary">{status.hint}</span>
        )}
      </span>

      <span className="flex items-center justify-start gap-2 lg:justify-end">
        {picking ? (
          <MatchForm name={name} members={members} onDone={() => setChanging(false)} />
        ) : (
          <button type="button" onClick={() => setChanging(true)} className={QUIET}>
            Change
          </button>
        )}
        {name.mappingId ? <ClearMatch mappingId={name.mappingId} name={name.name} /> : null}
      </span>
    </li>
  );
}

function MatchForm({ name, members, onDone }: { name: SheetName; members: SearchOption[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(saveSheetMappingAction, null);
  useActionToast(state);
  const [memberId, setMemberId] = useState("");

  return (
    <form
      action={(formData) => {
        setMemberId("");
        onDone();
        action(formData);
      }}
      className="flex w-full items-center gap-2 lg:w-auto"
    >
      <input type="hidden" name="name" value={name.name} />
      <input type="hidden" name="lc" value={name.lc} />
      <input type="hidden" name="team" value={name.team} />
      <SearchSelect
        name="memberId"
        label={`Who is "${name.name}"?`}
        placeholder="Choose a member"
        searchPlaceholder="Search members…"
        emptyText="No member matches"
        options={members}
        value={memberId}
        onChange={setMemberId}
        className="min-w-0 flex-1 lg:w-56 lg:flex-none"
        buttonClassName="py-1.5 text-xs"
      />
      <button type="submit" disabled={pending || memberId === ""} className={SECONDARY}>
        {pending ? "Saving…" : "Match"}
      </button>
    </form>
  );
}

function ClearMatch({ mappingId, name }: { mappingId: string; name: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(clearSheetMappingAction, null);
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="mappingId" value={mappingId} />
      <button type="submit" disabled={pending} className={QUIET} aria-label={`Remove the match for ${name}`}>
        {pending ? "Removing…" : "Remove match"}
      </button>
    </form>
  );
}

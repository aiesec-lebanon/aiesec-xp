"use client";

import { useActionState, useRef, useState } from "react";

import { importSheetMappingsCsvAction, type CsvImportState } from "@/lib/admin/assignment-actions";
import {
  DIRECTORY_ID_HEADER,
  DIRECTORY_LC_HEADER,
  DIRECTORY_NAME_HEADER,
  DIRECTORY_TEAM_HEADER,
} from "@/lib/import/sheet-parser";
import { useActionToast } from "@/components/studio/toast";

type NameToMatch = { name: string; lc: string; team: string };

const HEADERS = [DIRECTORY_LC_HEADER, DIRECTORY_TEAM_HEADER, DIRECTORY_NAME_HEADER, DIRECTORY_ID_HEADER];

const COLUMNS: { header: string; required: boolean; note: string }[] = [
  { header: DIRECTORY_LC_HEADER, required: false, note: "The LC the manager is in, as MasterSheet writes it." },
  { header: DIRECTORY_TEAM_HEADER, required: false, note: "Their function, as MasterSheet writes it." },
  {
    header: DIRECTORY_NAME_HEADER,
    required: true,
    note: "Exactly as written in MasterSheet's “EP Manager” column. Case and accents don't matter.",
  },
  { header: DIRECTORY_ID_HEADER, required: true, note: "The member's EXPA person ID, digits only." },
];

const EXAMPLE: string[][] = [
  ["AUB", "OGX", "Ahmad M", "1234567"],
  ["LAU", "MOGX", "Ahmad K", "7654321"],
];

const PRIMARY =
  "rounded-[10px] bg-stage-apl px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-apl-ink disabled:opacity-50";
const SECONDARY =
  "rounded-[10px] border border-ink bg-surface-raised px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50";
const QUIET =
  "whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold text-apl-ink transition-colors hover:bg-apl-wash";

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function download(filename: string, rows: string[][]): void {
  // The BOM makes Excel open the file as UTF-8, so accented names survive.
  const text = String.fromCharCode(0xfeff) + rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Matches many EP manager names to members at once from a CSV. */
export function CsvImport({ unmatched }: { unmatched: NameToMatch[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CsvImportState | null, FormData>(
    importSheetMappingsCsvAction,
    null
  );
  useActionToast(state);
  const [fileName, setFileName] = useState("");

  function close() {
    dialog.current?.close();
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className={SECONDARY}>
        Import CSV
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="csv-import-title"
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        className="m-auto w-[min(640px,calc(100vw-32px))] rounded-[24px] bg-surface-raised p-0 text-ink shadow-e3 backdrop:bg-black/40"
      >
        <div className="flex max-h-[85vh] flex-col gap-5 overflow-y-auto p-6 sm:p-8">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 id="csv-import-title" className="font-display text-xl font-semibold text-ink">
                Import manager names from a CSV
              </h2>
              <p className="mt-1.5 text-[13px] text-ink-secondary">
                Match many EP manager names to members at once. Each row works like choosing a
                member below: it takes priority over the sheet&rsquo;s Sheet7 list, and a row for a
                name that&rsquo;s already matched replaces that match.
              </p>
            </div>
            <button type="button" onClick={close} aria-label="Close" className={QUIET}>
              Close
            </button>
          </header>

          <section className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
              The format the system expects
            </h3>
            <p className="text-[13px] text-ink-secondary">
              A CSV with this header row, the same columns as Sheet7. Columns are found by their
              header, so their order doesn&rsquo;t matter, and any other column is ignored.
            </p>

            <div className="overflow-x-auto rounded-xl border border-ink/10">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface">
                  <tr>
                    {HEADERS.map((header) => (
                      <th key={header} className="whitespace-nowrap px-3 py-2 font-semibold text-ink">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {EXAMPLE.map((row, index) => (
                    <tr key={index} className="border-t border-ink/10">
                      {row.map((cell, column) => (
                        <td key={column} className="whitespace-nowrap px-3 py-2 font-mono text-ink-secondary">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <pre className="overflow-x-auto rounded-xl bg-surface px-3.5 py-2.5 font-mono text-[12px] text-ink">
              {[HEADERS, ...EXAMPLE].map((row) => row.map(csvField).join(",")).join("\n")}
            </pre>

            <ul className="flex flex-col gap-1.5">
              {COLUMNS.map((column) => (
                <li key={column.header} className="text-[12px] text-ink-secondary">
                  <b className="text-ink">{column.header}</b>{" "}
                  <span className="text-ink-faint">{column.required ? "(required)" : "(optional)"}</span>{" "}
                  &mdash; {column.note}
                </li>
              ))}
              <li className="text-[12px] text-ink-secondary">
                Fill in LC and Team when two managers share a name, so the right one is credited.
                Rows with no EXPA ID, or an ID that isn&rsquo;t a member this term, are skipped and
                listed after the import.
              </li>
            </ul>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => download("manager-names-template.csv", [HEADERS, ...EXAMPLE])}
                className={SECONDARY}
              >
                Download template
              </button>
              {unmatched.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    download("manager-names-to-match.csv", [
                      HEADERS,
                      ...unmatched.map((name) => [name.lc, name.team, name.name, ""]),
                    ])
                  }
                  className={SECONDARY}
                >
                  Download the {unmatched.length} unmatched {unmatched.length === 1 ? "name" : "names"}
                </button>
              ) : null}
            </div>
          </section>

          <form
            ref={form}
            action={(formData) => {
              action(formData);
              form.current?.reset();
              setFileName("");
            }}
            className="flex flex-col gap-3 border-t border-ink/10 pt-5"
          >
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
              CSV file
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                required
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
                className="text-[13px] font-normal text-ink-secondary file:mr-3 file:rounded-[10px] file:border file:border-ink file:bg-surface-raised file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-ink"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className={SECONDARY}>
                Cancel
              </button>
              <button type="submit" disabled={pending || fileName === ""} className={PRIMARY}>
                {pending ? "Importing…" : "Import"}
              </button>
            </div>
          </form>

          {state && state.problems.length > 0 ? (
            <section className="flex flex-col gap-2" aria-live="polite">
              <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
                Skipped {state.problems.length === 1 ? "row" : "rows"}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {state.problems.map((problem, index) => (
                  <li key={index} className="flex items-start gap-2.5 rounded-xl bg-re-wash px-3.5 py-2 text-[13px] text-ink">
                    <span aria-hidden className="mt-1.5 size-2 flex-none rounded-full bg-stage-re" />
                    {problem}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

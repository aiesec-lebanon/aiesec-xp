// Parses an assignment sheet. Pure, so the rules below are testable without a
// network call.
//
// The sheets carry a full sign-up form: name, date of birth, email, phone,
// nationality, languages, university, major. None of that may enter this
// system (D-42, Architecture.md 10). Two columns are read and the row is then
// discarded, so there is no code path by which the rest could be stored even by
// accident.

export const RESPONSIBLE_MEMBER_HEADER = "Responsible Member";
export const EP_ID_HEADER = "EP ID";

export type SheetRow = {
  /** 1-based, counting the header, so it matches what the admin sees. */
  lineNumber: number;
  managerLabel: string;
  epPersonId: bigint;
};

export type RowProblem = {
  lineNumber: number;
  reason: "MISSING_EP_ID" | "INVALID_EP_ID" | "MISSING_MANAGER";
  detail: string;
};

export type ParsedSheet = {
  rows: SheetRow[];
  problems: RowProblem[];
  /** Distinct manager labels seen, for alias mapping. */
  managerLabels: string[];
};

/**
 * Minimal RFC 4180 reader. Google's CSV export quotes any field containing a
 * comma, and these sheets do, so splitting on commas would silently shift every
 * column after a comma-bearing name.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export class SheetShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetShapeError";
  }
}

/**
 * Columns are located by header rather than by position. The MC edits these
 * sheets, and a column inserted at the front would otherwise import the wrong
 * field silently -- names as ids, or one member's EPs credited to another.
 */
function locateColumns(header: readonly string[]): { manager: number; epId: number } {
  const normalised = header.map((cell) => cell.trim().toLowerCase());
  const manager = normalised.indexOf(RESPONSIBLE_MEMBER_HEADER.toLowerCase());
  const epId = normalised.indexOf(EP_ID_HEADER.toLowerCase());

  if (manager === -1 || epId === -1) {
    const missing = [
      manager === -1 ? RESPONSIBLE_MEMBER_HEADER : null,
      epId === -1 ? EP_ID_HEADER : null,
    ].filter(Boolean);
    throw new SheetShapeError(
      `Sheet is missing required column(s): ${missing.join(", ")}. Found: ${header.join(", ")}`
    );
  }

  return { manager, epId };
}

export function parseSheet(csv: string): ParsedSheet {
  const table = parseCsv(csv).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (table.length === 0) {
    throw new SheetShapeError("Sheet is empty");
  }

  const { manager, epId } = locateColumns(table[0]);

  const rows: SheetRow[] = [];
  const problems: RowProblem[] = [];
  const labels = new Set<string>();

  for (let index = 1; index < table.length; index += 1) {
    const line = table[index];
    const lineNumber = index + 1;

    const rawId = (line[epId] ?? "").trim();
    const managerLabel = (line[manager] ?? "").trim();

    if (rawId === "") {
      problems.push({ lineNumber, reason: "MISSING_EP_ID", detail: "No EP ID in the row" });
      continue;
    }
    if (!/^\d+$/.test(rawId)) {
      problems.push({
        lineNumber,
        reason: "INVALID_EP_ID",
        detail: `EP ID is not a number: ${rawId}`,
      });
      continue;
    }
    if (managerLabel === "") {
      problems.push({
        lineNumber,
        reason: "MISSING_MANAGER",
        detail: "No responsible member named",
      });
      continue;
    }

    rows.push({ lineNumber, managerLabel, epPersonId: BigInt(rawId) });
    labels.add(managerLabel);
  }

  return { rows, problems, managerLabels: [...labels].sort() };
}

export function csvExportUrl(spreadsheetId: string, tabName: string): string {
  const params = new URLSearchParams({ tqx: "out:csv", sheet: tabName });
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
}

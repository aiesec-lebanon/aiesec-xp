// Sign-up rows carry personal data that must never be stored; only these four columns are read.
const EP_ID_HEADER = "EP ID";
const EP_MANAGER_HEADER = "EP Manager";
const EP_LC_HEADER = "LC Assigned To";
const EP_TEAM_HEADER = "Function Assigned to";

export const DIRECTORY_LC_HEADER = "LC";
export const DIRECTORY_TEAM_HEADER = "Team";
export const DIRECTORY_NAME_HEADER = "EP Manager Name";
export const DIRECTORY_ID_HEADER = "EXPA ID";

export type SignupRow = {
  // 1-based, counting the header, so it matches the sheet's row numbers.
  lineNumber: number;
  epPersonId: bigint;
  managerLabel: string;
  lc: string;
  team: string;
};

export type RowProblem = {
  lineNumber: number;
  reason: "MISSING_EP_ID" | "INVALID_EP_ID";
  detail: string;
};

export type ParsedSignups = {
  rows: SignupRow[];
  problems: RowProblem[];
};

// Deliberately nothing fuzzier than case/accents/spacing: "Ahmad M" and "Ahmad K" are two people.
export function normaliseLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// Minimal RFC 4180 reader: Google quotes comma-bearing fields, so a naive split would shift columns.
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

function table(csv: string, tabName: string): string[][] {
  const rows = parseCsv(csv).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) throw new SheetShapeError(`The "${tabName}" tab is empty.`);
  return rows;
}

// By header, not position: the MC edits this sheet and an inserted column would silently import the wrong field.
function columnOf(header: readonly string[], name: string): number {
  return header.findIndex((cell) => normaliseLabel(cell) === normaliseLabel(name));
}

function listColumns(names: readonly string[]): string {
  return names.map((name) => `"${name}"`).join(" and ");
}

export function parseSignups(csv: string, tabName: string): ParsedSignups {
  const rows = table(csv, tabName);
  const header = rows[0];
  const epId = columnOf(header, EP_ID_HEADER);
  const manager = columnOf(header, EP_MANAGER_HEADER);
  const lc = columnOf(header, EP_LC_HEADER);
  const team = columnOf(header, EP_TEAM_HEADER);

  const missing = [epId === -1 ? EP_ID_HEADER : null, manager === -1 ? EP_MANAGER_HEADER : null].filter(
    (name): name is string => name !== null
  );
  if (missing.length > 0) {
    throw new SheetShapeError(
      `The "${tabName}" tab needs ${missing.length === 1 ? "a column" : "columns"} headed ${listColumns(missing)}. Check the tab's name and its first row.`
    );
  }

  const parsed: ParsedSignups = { rows: [], problems: [] };

  for (let index = 1; index < rows.length; index += 1) {
    const line = rows[index];
    const lineNumber = index + 1;
    const rawId = (line[epId] ?? "").trim();

    if (rawId === "") {
      parsed.problems.push({ lineNumber, reason: "MISSING_EP_ID", detail: "The EP ID is empty." });
      continue;
    }
    if (!/^\d+$/.test(rawId)) {
      parsed.problems.push({
        lineNumber,
        reason: "INVALID_EP_ID",
        detail: `The EP ID "${rawId}" isn't a number.`,
      });
      continue;
    }

    parsed.rows.push({
      lineNumber,
      epPersonId: BigInt(rawId),
      managerLabel: (line[manager] ?? "").trim(),
      lc: lc === -1 ? "" : (line[lc] ?? "").trim(),
      team: team === -1 ? "" : (line[team] ?? "").trim(),
    });
  }

  return parsed;
}

export type DirectorySource = "SHEET" | "CONSOLE";

export type DirectoryEntry = {
  name: string;
  lc: string;
  team: string;
  memberId: bigint;
  source: DirectorySource;
};

export type ParsedDirectory = {
  entries: DirectoryEntry[];
  missingIds: string[];
  invalid: { lineNumber: number; detail: string }[];
};

function readDirectory(csv: string, tabName: string, onWrongShape: () => SheetShapeError): ParsedDirectory {
  const rows = table(csv, tabName);
  const header = rows[0];
  const name = columnOf(header, DIRECTORY_NAME_HEADER);
  const id = columnOf(header, DIRECTORY_ID_HEADER);
  const lc = columnOf(header, DIRECTORY_LC_HEADER);
  const team = columnOf(header, DIRECTORY_TEAM_HEADER);

  if (name === -1 || id === -1) throw onWrongShape();

  const parsed: ParsedDirectory = { entries: [], missingIds: [], invalid: [] };

  for (let index = 1; index < rows.length; index += 1) {
    const line = rows[index];
    const label = (line[name] ?? "").trim();
    const rawId = (line[id] ?? "").trim();
    if (label === "") continue;

    if (rawId === "") {
      parsed.missingIds.push(label);
      continue;
    }
    if (!/^\d+$/.test(rawId)) {
      parsed.invalid.push({ lineNumber: index + 1, detail: `${label}'s EXPA ID "${rawId}" isn't a number.` });
      continue;
    }

    parsed.entries.push({
      name: label,
      lc: lc === -1 ? "" : (line[lc] ?? "").trim(),
      team: team === -1 ? "" : (line[team] ?? "").trim(),
      memberId: BigInt(rawId),
      source: "SHEET",
    });
  }

  return parsed;
}

// Google answers an unknown tab name with the first tab and a 200, so the header is the only proof.
export function parseDirectory(csv: string, tabName: string): ParsedDirectory {
  return readDirectory(
    csv,
    tabName,
    () =>
      new SheetShapeError(
        `The sheet has no "${tabName}" tab with ${listColumns([DIRECTORY_NAME_HEADER, DIRECTORY_ID_HEADER])} columns, so managers can only be matched here on the console.`
      )
  );
}

export function parseManagerCsv(csv: string): ParsedDirectory {
  // Excel's "CSV UTF-8" adds a BOM that would otherwise hide the first header.
  return readDirectory(
    csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv,
    "CSV",
    () =>
      new SheetShapeError(
        `The file needs columns headed ${listColumns([DIRECTORY_NAME_HEADER, DIRECTORY_ID_HEADER])} in its first row. Download the template to see the layout.`
      )
  );
}

export function directoryKey(entry: { name: string; lc: string; team: string }): string {
  return [entry.name, entry.lc, entry.team].map(normaliseLabel).join("|");
}

// A console match overrides the sheet for the same key: the sheet must not quietly reverse an admin.
export function mergeDirectory(
  sheet: readonly DirectoryEntry[],
  console: readonly DirectoryEntry[]
): DirectoryEntry[] {
  const overridden = new Set(console.map(directoryKey));
  return [...sheet.filter((entry) => !overridden.has(directoryKey(entry))), ...console];
}

export type Resolution =
  | { kind: "matched"; memberId: bigint; source: DirectorySource }
  | { kind: "unlisted" }
  | { kind: "ambiguous" };

function narrow(entries: DirectoryEntry[], field: "lc" | "team", value: string): DirectoryEntry[] {
  if (value === "") return entries;
  const key = normaliseLabel(value);
  const kept = entries.filter((entry) => normaliseLabel(entry[field]) === key);
  return kept.length > 0 ? kept : entries;
}

function single(entries: DirectoryEntry[]): Resolution | null {
  const ids = new Set(entries.map((entry) => String(entry.memberId)));
  if (ids.size !== 1) return null;
  const source = entries.some((entry) => entry.source === "CONSOLE") ? "CONSOLE" : "SHEET";
  return { kind: "matched", memberId: entries[0].memberId, source };
}

// Still-ambiguous names match nobody: a wrong guess would send points to the wrong person.
export function resolveManager(
  directory: readonly DirectoryEntry[],
  row: Pick<SignupRow, "managerLabel" | "lc" | "team">
): Resolution {
  const key = normaliseLabel(row.managerLabel);
  const named = directory.filter((entry) => normaliseLabel(entry.name) === key);
  if (named.length === 0) return { kind: "unlisted" };

  const byLc = narrow(named, "lc", row.lc);
  const byTeam = narrow(byLc, "team", row.team);
  return single(named) ?? single(byLc) ?? single(byTeam) ?? { kind: "ambiguous" };
}

export function csvExportUrl(spreadsheetId: string, tabName: string): string {
  const params = new URLSearchParams({ tqx: "out:csv", sheet: tabName });
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
}

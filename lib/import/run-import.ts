import "server-only";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { applySource, SYSTEM_ACTOR } from "@/lib/assignments/register";
import { inTermRoles } from "@/lib/org/members";
import {
  csvExportUrl,
  directoryKey,
  mergeDirectory,
  parseDirectory,
  parseSignups,
  resolveManager,
  SheetShapeError,
  type DirectoryEntry,
  type DirectorySource,
} from "@/lib/import/sheet-parser";

const FETCH_TIMEOUT_MS = 30_000;

export type ImportIssue = {
  lineNumber: number | null;
  detail: string;
};

export type SheetManagerName = {
  name: string;
  lc: string;
  team: string;
  eps: number;
  status: "matched" | "unlisted" | "ambiguous" | "not-member";
  memberId: string | null;
  source: DirectorySource | null;
  mappingId: string | null;
};

export type ImportResult = {
  dryRun: boolean;
  sheetRead: boolean;
  sheetLabel: string | null;
  epsListed: number;
  epsMatched: number;
  epsUnassigned: number;
  assignmentsWritten: number;
  names: SheetManagerName[];
  issues: ImportIssue[];
};

export const NOT_SHARED_MESSAGE =
  "The sign-up sheet isn't shared. In Google Sheets, set General access to \"Anyone with the link\" (Viewer).";

type Fetcher = (url: string) => Promise<{ status: number; ok: boolean; text: () => Promise<string> }>;

// An unshared sheet must be a reported issue, never something that takes the page down.
export async function readSheetCsv(
  spreadsheetId: string,
  tabName: string,
  fetcher: Fetcher = (url) => fetch(url, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
): Promise<string> {
  let response;
  try {
    response = await fetcher(csvExportUrl(spreadsheetId, tabName));
  } catch (error) {
    logger.warn("Sign-up sheet unreachable", { error });
    throw new Error("Google Sheets didn't respond. Try again in a few minutes.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(NOT_SHARED_MESSAGE);
  }
  if (!response.ok) {
    logger.warn("Sign-up sheet read failed", { status: response.status });
    throw new Error(`Google Sheets couldn't open the sign-up sheet (error ${response.status}). Try again in a few minutes.`);
  }

  const body = await response.text();
  // An unshared sheet can also answer 200 with an HTML sign-in page.
  if (body.trimStart().startsWith("<")) {
    throw new Error(NOT_SHARED_MESSAGE);
  }
  return body;
}

function describe(error: unknown): string {
  if (error instanceof SheetShapeError) return error.message;
  return error instanceof Error ? error.message : "The sign-up sheet couldn't be read. Try again in a few minutes.";
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

async function consoleEntries(): Promise<(DirectoryEntry & { id: string })[]> {
  const rows = await db.sheetManagerMapping.findMany({
    select: { id: true, name: true, lc: true, team: true, memberId: true },
  });
  return rows.map((row) => ({ ...row, source: "CONSOLE" as const }));
}

function emptyResult(dryRun: boolean, sheetLabel: string | null, issues: ImportIssue[]): ImportResult {
  return {
    dryRun,
    sheetRead: false,
    sheetLabel,
    epsListed: 0,
    epsMatched: 0,
    epsUnassigned: 0,
    assignmentsWritten: 0,
    names: [],
    issues,
  };
}

export async function importAssignments(
  actorId: bigint,
  { dryRun = true }: { dryRun?: boolean } = {}
): Promise<ImportResult> {
  const [sheet, members, mapped] = await Promise.all([
    db.assignmentSheet.findFirst({ where: { isActive: true }, orderBy: { label: "asc" } }),
    inTermRoles(),
    consoleEntries(),
  ]);

  if (!sheet) {
    return emptyResult(dryRun, null, [{ lineNumber: null, detail: "No sign-up sheet is set up." }]);
  }

  const issues: ImportIssue[] = [];

  let signups;
  try {
    signups = parseSignups(await readSheetCsv(sheet.spreadsheetId, sheet.tabName), sheet.tabName);
  } catch (error) {
    return emptyResult(dryRun, sheet.label, [{ lineNumber: null, detail: describe(error) }]);
  }

  for (const problem of signups.problems) issues.push({ lineNumber: problem.lineNumber, detail: problem.detail });

  let fromSheet: DirectoryEntry[] = [];
  try {
    const directory = parseDirectory(
      await readSheetCsv(sheet.spreadsheetId, sheet.managersTabName),
      sheet.managersTabName
    );
    fromSheet = directory.entries;
    if (directory.missingIds.length > 0) {
      issues.push({
        lineNumber: null,
        detail: `${plural(directory.missingIds.length, "manager")} in the "${sheet.managersTabName}" tab ${
          directory.missingIds.length === 1 ? "has" : "have"
        } no EXPA ID yet: ${directory.missingIds.join(", ")}.`,
      });
    }
    for (const problem of directory.invalid) issues.push(problem);
  } catch (error) {
    issues.push({ lineNumber: null, detail: describe(error) });
  }

  const directory = mergeDirectory(fromSheet, mapped);
  const mappingByKey = new Map(mapped.map((entry) => [directoryKey(entry), entry.id]));

  // EPs whose manager can't be matched are left out, so they keep their existing credit.
  const desired = new Map<string, Set<string>>();
  const firstLine = new Map<string, { lineNumber: number; memberId: string | null }>();
  const conflicted = new Set<string>();
  const names = new Map<string, SheetManagerName>();
  let epsUnassigned = 0;

  for (const row of signups.rows) {
    const ep = String(row.epPersonId);
    let memberId: string | null = null;

    if (row.managerLabel !== "") {
      const key = directoryKey({ name: row.managerLabel, lc: row.lc, team: row.team });
      const resolution = resolveManager(directory, row);
      const matched = resolution.kind === "matched" ? String(resolution.memberId) : null;
      const status: SheetManagerName["status"] =
        resolution.kind !== "matched" ? resolution.kind : members.has(matched!) ? "matched" : "not-member";

      const name = names.get(key) ?? {
        name: row.managerLabel,
        lc: row.lc,
        team: row.team,
        eps: 0,
        status,
        memberId: matched,
        source: resolution.kind === "matched" ? resolution.source : null,
        mappingId: mappingByKey.get(key) ?? null,
      };
      name.eps += 1;
      names.set(key, name);

      if (status !== "matched") continue;
      memberId = matched;
    } else {
      epsUnassigned += 1;
    }

    const previous = firstLine.get(ep);
    if (previous) {
      // Conflicting lines are not settled by reading order; neither is used.
      if (previous.memberId !== memberId && !conflicted.has(ep)) {
        conflicted.add(ep);
        issues.push({
          lineNumber: row.lineNumber,
          detail: `EP ${ep} is also on line ${previous.lineNumber} with a different manager. Neither line is used until one is corrected.`,
        });
      }
      continue;
    }

    firstLine.set(ep, { lineNumber: row.lineNumber, memberId });
    desired.set(ep, new Set(memberId ? [memberId] : []));
  }

  for (const ep of conflicted) desired.delete(ep);

  const epsListed = new Set(signups.rows.map((row) => String(row.epPersonId))).size;
  const epsMatched = [...desired.values()].filter((set) => set.size > 0).length;
  let assignmentsWritten = 0;

  if (!dryRun) {
    const changes = await applySource("SHEET", desired, actorId);
    assignmentsWritten = epsMatched;

    await db.assignmentSheet.update({ where: { id: sheet.id }, data: { lastImportAt: new Date() } });

    // The sync imports every run, so only audit system runs that changed something.
    const changed = changes.created + changes.flagged + changes.cleared + changes.dropped;
    if (actorId !== SYSTEM_ACTOR || changed > 0) {
      await db.auditLog.create({
        data: {
          actorId,
          action: "IMPORT",
          targetType: "EpAssignment",
          targetId: "sheet-import",
          afterJson: { assignmentsWritten, ...changes, epsListed, epsUnassigned },
        },
      });
    }
  }

  logger.info("Assignment import finished", {
    dryRun,
    epsListed,
    epsMatched,
    epsUnassigned,
    assignmentsWritten,
    issues: issues.length,
  });

  const order: Record<SheetManagerName["status"], number> = { ambiguous: 0, unlisted: 1, "not-member": 2, matched: 3 };

  return {
    dryRun,
    sheetRead: true,
    sheetLabel: sheet.label,
    epsListed,
    epsMatched,
    epsUnassigned,
    assignmentsWritten,
    names: [...names.values()].sort(
      (a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name) || a.lc.localeCompare(b.lc)
    ),
    issues,
  };
}

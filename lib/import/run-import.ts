import "server-only";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { indexAliases, resolveLabel, type Suggestion } from "@/lib/import/name-matching";
import { csvExportUrl, parseSheet, SheetShapeError } from "@/lib/import/sheet-parser";

const FETCH_TIMEOUT_MS = 30_000;

export type ImportIssue = {
  sheet: string;
  lineNumber: number | null;
  detail: string;
};

export type ImportResult = {
  dryRun: boolean;
  sheetsRead: number;
  rowsRead: number;
  assignmentsWritten: number;
  rowsSkipped: number;
  /** Labels with no alias, each with candidates for an admin to confirm. */
  unmappedLabels: { label: string; rowCount: number; suggestions: Suggestion[] }[];
  issues: ImportIssue[];
};

async function fetchSheet(spreadsheetId: string, tabName: string): Promise<string> {
  const response = await fetch(csvExportUrl(spreadsheetId, tabName), {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Sheet is not readable. Share it as 'Anyone with the link can view', or the import cannot see it."
    );
  }
  if (!response.ok) {
    throw new Error(`Sheet responded ${response.status}`);
  }

  const body = await response.text();
  // A sheet that is not shared returns an HTML sign-in page with a 200.
  if (body.trimStart().startsWith("<")) {
    throw new Error("Sheet returned a sign-in page rather than CSV; check its sharing settings.");
  }
  return body;
}

/**
 * Imports every active sheet.
 *
 * Dry run by default: the MC should see what an import would do before it
 * changes who is credited with what. Nothing is written until `dryRun` is false.
 *
 * Only the responsible member and the EP id are read. The sheets also carry
 * names, dates of birth, emails, phone numbers and academic history, none of
 * which this system may hold (D-42).
 */
export async function importAssignments(
  actorId: bigint,
  { dryRun = true }: { dryRun?: boolean } = {}
): Promise<ImportResult> {
  const [sheets, aliasRows, members, windowRow] = await Promise.all([
    db.assignmentSheet.findMany({ where: { isActive: true } }),
    db.managerAlias.findMany(),
    db.member.findMany({ select: { id: true, fullName: true } }),
    db.displayWindow.findFirst({ where: { isActive: true } }),
  ]);

  if (!windowRow) throw new Error("No active DisplayWindow; an import has no effective date");

  const aliases = indexAliases(aliasRows);
  const issues: ImportIssue[] = [];
  const unmapped = new Map<string, { rowCount: number; suggestions: Suggestion[] }>();

  // EP -> member, the resolved intent across every sheet.
  const resolved = new Map<string, { memberId: bigint; sheet: string; lineNumber: number }>();
  let rowsRead = 0;
  let rowsSkipped = 0;
  let sheetsRead = 0;

  for (const sheet of sheets) {
    let csv: string;
    try {
      csv = await fetchSheet(sheet.spreadsheetId, sheet.tabName);
    } catch (error) {
      issues.push({
        sheet: sheet.label,
        lineNumber: null,
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    let parsed;
    try {
      parsed = parseSheet(csv);
    } catch (error) {
      issues.push({
        sheet: sheet.label,
        lineNumber: null,
        detail:
          error instanceof SheetShapeError ? error.message : `Could not parse sheet: ${error}`,
      });
      continue;
    }

    sheetsRead += 1;
    rowsRead += parsed.rows.length;

    for (const problem of parsed.problems) {
      issues.push({ sheet: sheet.label, lineNumber: problem.lineNumber, detail: problem.detail });
      rowsSkipped += 1;
    }

    for (const row of parsed.rows) {
      const resolution = resolveLabel(row.managerLabel, aliases, members);

      if (resolution.status === "UNMAPPED") {
        const existing = unmapped.get(row.managerLabel);
        if (existing) existing.rowCount += 1;
        else unmapped.set(row.managerLabel, { rowCount: 1, suggestions: resolution.suggestions });
        rowsSkipped += 1;
        continue;
      }

      const key = String(row.epPersonId);
      const previous = resolved.get(key);

      // The same EP in two sheets under two different members is a real
      // disagreement between the MC's own records, not something to resolve by
      // picking whichever sheet was read last.
      if (previous && previous.memberId !== resolution.memberId) {
        issues.push({
          sheet: sheet.label,
          lineNumber: row.lineNumber,
          detail: `EP ${key} is assigned to a different member in ${previous.sheet} line ${previous.lineNumber}. Left unchanged.`,
        });
        resolved.delete(key);
        rowsSkipped += 1;
        continue;
      }

      resolved.set(key, {
        memberId: resolution.memberId,
        sheet: sheet.label,
        lineNumber: row.lineNumber,
      });
    }
  }

  let assignmentsWritten = 0;

  if (!dryRun && resolved.size > 0) {
    // D-36: an assignment claims the EP's whole funnel, so it takes effect from
    // the EP's earliest known event, or the window start when nothing is known
    // yet.
    const earliest = await db.exchangeEvent.groupBy({
      by: ["epPersonId"],
      _min: { occurredAt: true },
      where: { epPersonId: { in: [...resolved.keys()].map(BigInt) } },
    });
    const earliestByEp = new Map(
      earliest.map((row) => [String(row.epPersonId), row._min.occurredAt ?? windowRow.startsAt])
    );

    // An admin correction outranks the sheet and is left alone.
    const overridden = new Set(
      (
        await db.epAssignment.findMany({
          where: { source: "ADMIN", epPersonId: { in: [...resolved.keys()].map(BigInt) } },
          select: { epPersonId: true },
        })
      ).map((row) => String(row.epPersonId))
    );

    for (const [key, target] of resolved) {
      if (overridden.has(key)) continue;

      const epPersonId = BigInt(key);
      const effectiveFrom = earliestByEp.get(key) ?? windowRow.startsAt;

      await db.epAssignment.upsert({
        where: { epPersonId_effectiveFrom: { epPersonId, effectiveFrom } },
        create: {
          epPersonId,
          memberId: target.memberId,
          effectiveFrom,
          source: "SHEET",
          createdBy: actorId,
        },
        update: { memberId: target.memberId, source: "SHEET" },
      });
      assignmentsWritten += 1;
    }

    await db.assignmentSheet.updateMany({
      where: { isActive: true },
      data: { lastImportAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        actorId,
        action: "IMPORT",
        targetType: "EpAssignment",
        targetId: "sheet-import",
        afterJson: { assignmentsWritten, rowsRead, rowsSkipped, sheetsRead },
      },
    });
  }

  logger.info("Assignment import finished", {
    dryRun,
    sheetsRead,
    rowsRead,
    assignmentsWritten,
    rowsSkipped,
    unmappedLabels: unmapped.size,
  });

  return {
    dryRun,
    sheetsRead,
    rowsRead,
    assignmentsWritten,
    rowsSkipped,
    unmappedLabels: [...unmapped.entries()]
      .map(([label, value]) => ({ label, ...value }))
      .sort((a, b) => b.rowCount - a.rowCount),
    issues,
  };
}

"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { personName } from "@/lib/design/names";
import { importAssignments } from "@/lib/import/run-import";
import { directoryKey, normaliseLabel, parseManagerCsv, SheetShapeError, type DirectoryEntry } from "@/lib/import/sheet-parser";
import { inTermMemberWhere } from "@/lib/org/members";
import { replay } from "@/lib/scoring/replay";

// Actions re-verify the actor against live GIS so a position revoked since the last sync takes effect now.

const bigintish = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => BigInt(value));

// JSON.stringify throws on bigint; a Json column needs DbNull rather than a bare null.
function toAuditJson(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  ) as Prisma.InputJsonValue;
}

async function audit(
  actorId: bigint,
  action: string,
  targetType: string,
  targetId: string,
  before: unknown,
  after: unknown
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      beforeJson: toAuditJson(before),
      afterJson: toAuditJson(after),
    },
  });
}

function refresh(): void {
  revalidatePath("/admin/assignments");
  revalidatePath("/leaderboard");
  revalidatePath("/");
}

export type ActionState = { ok: boolean; message: string };

export async function runImportAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const commit = formData.get("commit") === "true";

  const result = await importAssignments(admin.id, { dryRun: !commit });
  if (commit) await replay(admin.id);

  refresh();

  if (!result.sheetRead) {
    return { ok: false, message: result.issues[0]?.detail ?? "The sign-up sheet couldn't be read." };
  }

  const matched = `${result.epsMatched} of ${result.epsListed} EPs`;
  const attention =
    result.issues.length > 0
      ? ` ${result.issues.length === 1 ? "1 thing needs" : `${result.issues.length} things need`} attention below.`
      : "";
  return {
    ok: true,
    message: commit
      ? `Sheet imported. ${matched} are credited to a member.${attention}`
      : `Preview only, nothing saved. ${matched} would be credited to a member.${attention}`,
  };
}

const creditSchema = z.object({
  epPersonId: bigintish,
  memberId: bigintish,
});

function parseCredit(formData: FormData) {
  return creditSchema.safeParse({
    epPersonId: formData.get("epPersonId"),
    memberId: formData.get("memberId"),
  });
}

function epLabel(formData: FormData): string {
  const name = formData.get("epName");
  return typeof name === "string" && name.trim() !== "" ? name.trim() : "this EP";
}

const NOT_A_MEMBER = "Only people with a member position this term can earn points.";
const RELOAD = "Something went wrong. Reload the page and try again.";

export async function addManagerAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const parsed = parseCredit(formData);
  if (!parsed.success) return { ok: false, message: "Choose a member to add." };

  const { epPersonId, memberId } = parsed.data;

  const [member, before] = await Promise.all([
    // Enforced server-side too: the form is user input.
    db.member.findFirst({
      where: { id: memberId, ...(await inTermMemberWhere()) },
      select: { fullName: true },
    }),
    db.epAssignment.findUnique({ where: { epPersonId_memberId: { epPersonId, memberId } } }),
  ]);

  if (!member) return { ok: false, message: NOT_A_MEMBER };

  const after = await db.epAssignment.upsert({
    where: { epPersonId_memberId: { epPersonId, memberId } },
    create: { epPersonId, memberId, fromAdmin: true, createdBy: admin.id },
    update: { fromAdmin: true, removedAt: null, removedBy: null },
  });

  await audit(admin.id, "ASSIGNMENT_ADD", "EpAssignment", `${epPersonId}:${memberId}`, before, after);
  await replay(admin.id);
  refresh();

  return { ok: true, message: `${personName(member.fullName)} now earns points for ${epLabel(formData)}.` };
}

// The row is kept, marked removed, so the next EXPA or sheet sync cannot hand the credit back.
export async function removeManagerAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const parsed = parseCredit(formData);
  if (!parsed.success) return { ok: false, message: RELOAD };

  const { epPersonId, memberId } = parsed.data;

  const [member, before] = await Promise.all([
    db.member.findUnique({ where: { id: memberId }, select: { fullName: true } }),
    db.epAssignment.findUnique({ where: { epPersonId_memberId: { epPersonId, memberId } } }),
  ]);
  if (!member) return { ok: false, message: "This person isn't a member, so they aren't earning points for this EP." };

  const removal = { removedAt: new Date(), removedBy: admin.id, isMain: false };
  const after = await db.epAssignment.upsert({
    where: { epPersonId_memberId: { epPersonId, memberId } },
    create: { epPersonId, memberId, createdBy: admin.id, ...removal },
    update: removal,
  });

  await audit(admin.id, "ASSIGNMENT_REMOVE", "EpAssignment", `${epPersonId}:${memberId}`, before, after);
  await replay(admin.id);
  refresh();

  return { ok: true, message: `${personName(member.fullName)} no longer earns points for ${epLabel(formData)}.` };
}

export async function setMainManagerAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const parsed = parseCredit(formData);
  if (!parsed.success) return { ok: false, message: RELOAD };

  const { epPersonId, memberId } = parsed.data;

  const [member, row, before] = await Promise.all([
    db.member.findFirst({
      where: { id: memberId, ...(await inTermMemberWhere()) },
      select: { fullName: true },
    }),
    db.epAssignment.findUnique({ where: { epPersonId_memberId: { epPersonId, memberId } } }),
    db.epAssignment.findFirst({ where: { epPersonId, isMain: true } }),
  ]);

  if (!member) return { ok: false, message: NOT_A_MEMBER };
  if (!row || row.removedAt || !(row.fromExpa || row.fromSheet || row.fromAdmin)) {
    return { ok: false, message: "Only a manager already on this EP can be its main manager. Reload the page to see the latest." };
  }
  if (row.isMain) return { ok: true, message: `${personName(member.fullName)} is already the main manager.` };

  await db.$transaction([
    db.epAssignment.updateMany({ where: { epPersonId, isMain: true }, data: { isMain: false } }),
    db.epAssignment.update({ where: { id: row.id }, data: { isMain: true } }),
  ]);

  await audit(
    admin.id,
    "ASSIGNMENT_MAIN",
    "EpAssignment",
    `${epPersonId}:${memberId}`,
    { main: before ? String(before.memberId) : null },
    { main: String(memberId) }
  );
  await replay(admin.id);
  refresh();

  return {
    ok: true,
    message: `${personName(member.fullName)} is now the main manager for ${epLabel(formData)} and gets its full points.`,
  };
}

// If no source names the member any more, restoring marks the row ADMIN so it still counts.
export async function restoreManagerAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const parsed = parseCredit(formData);
  if (!parsed.success) return { ok: false, message: RELOAD };

  const { epPersonId, memberId } = parsed.data;

  const [member, before] = await Promise.all([
    db.member.findFirst({
      where: { id: memberId, ...(await inTermMemberWhere()) },
      select: { fullName: true },
    }),
    db.epAssignment.findUnique({ where: { epPersonId_memberId: { epPersonId, memberId } } }),
  ]);

  if (!before?.removedAt) return { ok: false, message: "This manager is already earning points. Reload the page to see the latest." };
  if (!member) return { ok: false, message: NOT_A_MEMBER };

  const after = await db.epAssignment.update({
    where: { id: before.id },
    data: {
      removedAt: null,
      removedBy: null,
      ...(before.fromExpa || before.fromSheet || before.fromAdmin ? {} : { fromAdmin: true }),
    },
  });

  await audit(admin.id, "ASSIGNMENT_RESTORE", "EpAssignment", `${epPersonId}:${memberId}`, before, after);
  await replay(admin.id);
  refresh();

  return { ok: true, message: `${personName(member.fullName)} earns points for ${epLabel(formData)} again.` };
}

const mappingSchema = z.object({
  name: z.string().trim().min(1).max(200),
  lc: z.string().trim().max(200),
  team: z.string().trim().max(200),
  memberId: bigintish,
});

async function rebuildFromSheet(adminId: bigint): Promise<void> {
  await importAssignments(adminId, { dryRun: false });
  await replay(adminId);
  refresh();
}

export async function saveSheetMappingAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const parsed = mappingSchema.safeParse({
    name: formData.get("name"),
    lc: formData.get("lc") ?? "",
    team: formData.get("team") ?? "",
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) return { ok: false, message: "Choose the member this name belongs to." };

  const { name, lc, team, memberId } = parsed.data;
  const member = await db.member.findFirst({
    where: { id: memberId, ...(await inTermMemberWhere()) },
    select: { fullName: true },
  });
  if (!member) return { ok: false, message: NOT_A_MEMBER };

  const key = { nameKey: normaliseLabel(name), lcKey: normaliseLabel(lc), teamKey: normaliseLabel(team) };
  const before = await db.sheetManagerMapping.findUnique({ where: { nameKey_lcKey_teamKey: key } });
  const after = await db.sheetManagerMapping.upsert({
    where: { nameKey_lcKey_teamKey: key },
    create: { ...key, name, lc, team, memberId, createdBy: admin.id },
    update: { name, lc, team, memberId },
  });

  await audit(admin.id, "SHEET_MAPPING_SAVE", "SheetManagerMapping", after.id, before, after);
  await rebuildFromSheet(admin.id);

  return {
    ok: true,
    message: `"${name}" in the sheet is now matched to ${personName(member.fullName)}, and their EPs are credited to them.`,
  };
}

export async function clearSheetMappingAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const id = formData.get("mappingId");
  if (typeof id !== "string" || id === "") return { ok: false, message: RELOAD };

  const before = await db.sheetManagerMapping.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "This match was already removed. Reload the page to see the latest." };

  await db.sheetManagerMapping.delete({ where: { id } });
  await audit(admin.id, "SHEET_MAPPING_CLEAR", "SheetManagerMapping", id, before, null);
  await rebuildFromSheet(admin.id);

  return { ok: true, message: `Match removed. "${before.name}" is now looked up in the sheet's own manager list.` };
}

export type CsvImportState = ActionState & { problems: string[] };

const CSV_MAX_BYTES = 256 * 1024;

function csvFailure(message: string, problems: string[] = []): CsvImportState {
  return { ok: false, message, problems };
}

// Untrustworthy rows (no ID, not a member, same name given two people) are skipped, never guessed.
export async function importSheetMappingsCsvAction(
  _previous: CsvImportState | null,
  formData: FormData
): Promise<CsvImportState> {
  const admin = await requireAdminLive();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return csvFailure("Choose a CSV file to import.");
  if (file.size > CSV_MAX_BYTES) return csvFailure("That file is too large. A manager list should be well under 256 KB.");

  let parsed;
  try {
    parsed = parseManagerCsv(await file.text());
  } catch (error) {
    return csvFailure(error instanceof SheetShapeError ? error.message : "The file couldn't be read as a CSV.");
  }

  const problems: string[] = [
    ...parsed.invalid.map((problem) => `Line ${problem.lineNumber}: ${problem.detail}`),
    ...parsed.missingIds.map((name) => `${name} has no EXPA ID, so was skipped.`),
  ];

  const byKey = new Map<string, DirectoryEntry>();
  const conflicted = new Set<string>();
  for (const entry of parsed.entries) {
    const key = directoryKey(entry);
    const seen = byKey.get(key);
    if (seen && seen.memberId !== entry.memberId && !conflicted.has(key)) {
      conflicted.add(key);
      problems.push(`${entry.name} is given two different EXPA IDs, so neither was used.`);
    }
    if (!seen) byKey.set(key, entry);
  }
  for (const key of conflicted) byKey.delete(key);

  const ids = [...new Set([...byKey.values()].map((entry) => entry.memberId))];
  const members = await db.member.findMany({
    where: { id: { in: ids }, ...(await inTermMemberWhere()) },
    select: { id: true },
  });
  const memberIds = new Set(members.map((member) => String(member.id)));

  const rows = [...byKey.values()].flatMap((entry) => {
    if (memberIds.has(String(entry.memberId))) return [entry];
    problems.push(`${entry.name}'s EXPA ID ${entry.memberId} isn't anyone with a member position this term.`);
    return [];
  });

  if (rows.length === 0) {
    return csvFailure("Nothing was imported. No row matched a name to a member this term.", problems);
  }

  const keyed = rows.map((entry) => ({
    entry,
    key: { nameKey: normaliseLabel(entry.name), lcKey: normaliseLabel(entry.lc), teamKey: normaliseLabel(entry.team) },
  }));
  const existing = await db.sheetManagerMapping.findMany({
    where: { OR: keyed.map(({ key }) => key) },
    select: { nameKey: true, lcKey: true, teamKey: true, memberId: true },
  });
  const before = new Map(existing.map((row) => [`${row.nameKey}|${row.lcKey}|${row.teamKey}`, row.memberId]));

  const changed = keyed.filter(({ key, entry }) => before.get(`${key.nameKey}|${key.lcKey}|${key.teamKey}`) !== entry.memberId);
  const created = changed.filter(({ key }) => !before.has(`${key.nameKey}|${key.lcKey}|${key.teamKey}`)).length;
  const updated = changed.length - created;

  if (changed.length > 0) {
    await db.$transaction(
      changed.map(({ key, entry }) =>
        db.sheetManagerMapping.upsert({
          where: { nameKey_lcKey_teamKey: key },
          create: { ...key, name: entry.name, lc: entry.lc, team: entry.team, memberId: entry.memberId, createdBy: admin.id },
          update: { name: entry.name, lc: entry.lc, team: entry.team, memberId: entry.memberId },
        })
      )
    );
    await audit(admin.id, "SHEET_MAPPING_IMPORT", "SheetManagerMapping", "csv-import", null, {
      file: file.name,
      created,
      updated,
      unchanged: rows.length - changed.length,
      skipped: problems.length,
      matches: changed.map(({ entry }) => entry),
    });
    await rebuildFromSheet(admin.id);
  }

  const parts = [
    created > 0 ? `${created} new` : null,
    updated > 0 ? `${updated} changed` : null,
    rows.length - changed.length > 0 ? `${rows.length - changed.length} already up to date` : null,
  ].filter(Boolean);
  const skipped = problems.length > 0 ? ` ${problems.length === 1 ? "1 row was" : `${problems.length} rows were`} skipped.` : "";

  return {
    ok: true,
    message: `Imported ${rows.length === 1 ? "1 match" : `${rows.length} matches`} (${parts.join(", ")}).${skipped}`,
    problems,
  };
}

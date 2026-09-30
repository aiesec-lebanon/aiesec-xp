"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { personName } from "@/lib/design/names";
import { importAssignments } from "@/lib/import/run-import";
import { normaliseLabel } from "@/lib/import/sheet-parser";
import { inTermMemberWhere } from "@/lib/org/members";
import { replay } from "@/lib/scoring/replay";

// Every action re-verifies the actor against live GIS (Architecture.md 11):
// these change who is credited with a reward, which is exactly the case where a
// position revoked since the last sync must take effect now.

const bigintish = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => BigInt(value));

/**
 * Every row audited here carries a BigInt column, and native JSON.stringify
 * throws on a bigint rather than converting it. Stringifying it instead is
 * enough: an audit entry is read, never diffed back into a typed value.
 *
 * A missing side -- no row before a first credit, or nothing after a delete --
 * is stored as SQL NULL: a Json column does not take a bare `null`.
 */
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

/** The EP as the admin saw it on the row, for the confirmation only. */
function epLabel(formData: FormData): string {
  const name = formData.get("epName");
  return typeof name === "string" && name.trim() !== "" ? name.trim() : "this EP";
}

const NOT_A_MEMBER = "Only people with a member position this term can earn points.";
const RELOAD = "Something went wrong. Reload the page and try again.";

/**
 * Credits one more member with an EP (D-73), beside whoever EXPA and the sheet
 * already name. Marked ADMIN, which no sync clears; adding someone an admin had
 * removed brings them back.
 */
export async function addManagerAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const parsed = parseCredit(formData);
  if (!parsed.success) return { ok: false, message: "Choose a member to add." };

  const { epPersonId, memberId } = parsed.data;

  const [member, before] = await Promise.all([
    // Enforced here, not just by the picker: the form is user input, and
    // crediting an EP to anyone who is not a member this term -- another EP,
    // a departed officer -- is never meaningful (D-71).
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

/**
 * Takes a member's credit for an EP away, whichever source gave it (D-73). The
 * row stays, marked removed, so the next EXPA or sheet sync cannot hand the
 * credit straight back. A manager EXPA lists who has not been synced yet gets
 * that row now, for the same reason.
 */
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

  const removal = { removedAt: new Date(), removedBy: admin.id };
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

/**
 * Undoes a removal. When nothing else names the member any more -- EXPA or the
 * sheet has since dropped them -- restoring is an admin crediting them, so the
 * row is marked ADMIN rather than coming back with no source that counts.
 */
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

/**
 * Matches an EP manager's name in the sign-up sheet to a member (D-80), for the
 * same name, LC and team the sheet uses. Preferred over the sheet's own
 * directory tab, so the sheet cannot quietly undo it.
 */
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

/** Removes a console match, so the name goes back to the sheet's own directory. */
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

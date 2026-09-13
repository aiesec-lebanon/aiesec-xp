"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { importAssignments } from "@/lib/import/run-import";
import { normalise, suggestMembers } from "@/lib/import/name-matching";

// Every action re-verifies the actor against live GIS (Architecture.md 11):
// these change who is credited with a reward, which is exactly the case where a
// position revoked since the last sync must take effect now.

const bigintish = z
  .string()
  .regex(/^\d+$/, "Expected a numeric id")
  .transform((value) => BigInt(value));

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
      beforeJson: before === undefined ? undefined : JSON.parse(JSON.stringify(before)),
      afterJson: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
    },
  });
}

export type ActionState = { ok: boolean; message: string };

export async function runImportAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const commit = formData.get("commit") === "true";

  const result = await importAssignments(admin.id, { dryRun: !commit });
  revalidatePath("/admin/assignments");

  const verb = commit ? "Imported" : "Dry run";
  const unmapped = result.unmappedLabels.length;
  return {
    ok: result.issues.length === 0 && unmapped === 0,
    message:
      `${verb}: ${result.rowsRead} rows from ${result.sheetsRead} sheet(s), ` +
      `${result.assignmentsWritten} written, ${result.rowsSkipped} skipped, ` +
      `${unmapped} unmapped label(s), ${result.issues.length} issue(s).`,
  };
}

const aliasSchema = z.object({
  label: z.string().trim().min(1, "A label is required"),
  memberId: bigintish,
});

/**
 * Maps a sheet label to a member.
 *
 * A label already pointing at someone else is not silently repointed: the
 * caller is told, and must send `confirm` to change it. Reassigning a label
 * moves every EP behind it to a different person.
 */
export async function mapAliasAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const parsed = aliasSchema.safeParse({
    label: formData.get("label"),
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const { label, memberId } = parsed.data;
  const key = normalise(label);
  const confirmed = formData.get("confirm") === "true";

  const [member, existing] = await Promise.all([
    db.member.findUnique({ where: { id: memberId }, select: { id: true, fullName: true } }),
    db.managerAlias.findUnique({ where: { label: key } }),
  ]);

  if (!member) return { ok: false, message: "That member no longer exists." };

  if (existing && existing.memberId !== memberId && !confirmed) {
    const current = await db.member.findUnique({
      where: { id: existing.memberId },
      select: { fullName: true },
    });
    return {
      ok: false,
      message: `"${label}" is already mapped to ${current?.fullName ?? "someone else"}. Confirm to move it to ${member.fullName}.`,
    };
  }

  await db.managerAlias.upsert({
    where: { label: key },
    create: { label: key, memberId },
    update: { memberId },
  });

  await audit(admin.id, "MATCH_CONFIRM", "ManagerAlias", key, existing, { label: key, memberId });
  revalidatePath("/admin/assignments");

  return { ok: true, message: `"${label}" now means ${member.fullName}.` };
}

export async function removeAliasAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { ok: false, message: "A label is required" };

  const key = normalise(label);
  const existing = await db.managerAlias.findUnique({ where: { label: key } });
  if (!existing) return { ok: false, message: "That label is not mapped." };

  await db.managerAlias.delete({ where: { label: key } });
  await audit(admin.id, "MATCH_CONFIRM", "ManagerAlias", key, existing, null);
  revalidatePath("/admin/assignments");

  return { ok: true, message: `Mapping for "${label}" removed. Its rows will stop scoring.` };
}

const overrideSchema = z.object({
  epPersonId: bigintish,
  memberId: bigintish,
});

/**
 * Overrides one EP's assignment by hand.
 *
 * Marked ADMIN, which is what keeps the next sheet import from undoing it: a
 * correction made here is a deliberate decision about who earned something, and
 * the sheet is not allowed to quietly reverse it.
 */
export async function overrideAssignmentAction(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();

  const parsed = overrideSchema.safeParse({
    epPersonId: formData.get("epPersonId"),
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { epPersonId, memberId } = parsed.data;

  const [member, window, earliest, existing] = await Promise.all([
    db.member.findUnique({ where: { id: memberId }, select: { fullName: true } }),
    db.displayWindow.findFirst({ where: { isActive: true } }),
    db.exchangeEvent.aggregate({ _min: { occurredAt: true }, where: { epPersonId } }),
    db.epAssignment.findFirst({ where: { epPersonId }, orderBy: { effectiveFrom: "asc" } }),
  ]);

  if (!member) return { ok: false, message: "That member no longer exists." };
  if (!window) return { ok: false, message: "No active display window." };

  const effectiveFrom = existing?.effectiveFrom ?? earliest._min.occurredAt ?? window.startsAt;

  const after = await db.epAssignment.upsert({
    where: { epPersonId_effectiveFrom: { epPersonId, effectiveFrom } },
    create: { epPersonId, memberId, effectiveFrom, source: "ADMIN", createdBy: admin.id },
    update: { memberId, source: "ADMIN" },
  });

  await audit(admin.id, "ASSIGNMENT_SET", "EpAssignment", String(epPersonId), existing, after);
  revalidatePath("/admin/assignments");

  return { ok: true, message: `EP ${epPersonId} is now credited to ${member.fullName}.` };
}

/** Candidate members for a label, for the admin to pick from. */
export async function suggestForLabel(label: string) {
  await requireAdminLive();
  const members = await db.member.findMany({ select: { id: true, fullName: true } });
  return suggestMembers(label, members).map((suggestion) => ({
    memberId: String(suggestion.member.id),
    fullName: suggestion.member.fullName,
    confidence: suggestion.confidence,
    reason: suggestion.reason,
  }));
}

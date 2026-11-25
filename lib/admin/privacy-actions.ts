"use server";

import { revalidatePath } from "next/cache";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { forgetMember } from "@/lib/privacy/member-data";

export type PrivacyActionResult = { ok: true } | { ok: false; message: string };

type Status = "IN_PROGRESS" | "COMPLETED" | "REFUSED";

async function audit(actorId: bigint, action: string, targetId: string, after?: unknown) {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      targetType: "PrivacyRequest",
      targetId,
      afterJson: after === undefined ? undefined : JSON.parse(JSON.stringify(after)),
    },
  });
}

export async function setPrivacyRequestStatus(
  requestId: string,
  status: Status
): Promise<PrivacyActionResult> {
  const admin = await requireAdminLive();
  const closing = status !== "IN_PROGRESS";
  await db.privacyRequest.update({
    where: { id: requestId },
    data: {
      status,
      closedAt: closing ? new Date() : null,
      // The reply address and the address hash are only needed while it is open.
      ...(closing ? { replyEmail: null, ipHash: null } : {}),
    },
  });
  await audit(admin.id, `PRIVACY_${status}`, requestId);
  revalidatePath("/admin/privacy");
  return { ok: true };
}

/** Once the sender's identity is confirmed, ties the request to their XP record. */
export async function linkPrivacyRequest(
  requestId: string,
  expaId: string
): Promise<PrivacyActionResult> {
  const admin = await requireAdminLive();
  const id = expaId.trim();
  if (!/^\d{1,12}$/.test(id)) return { ok: false, message: "Enter the member's EXPA ID (digits only)." };

  const member = await db.member.findUnique({ where: { id: BigInt(id) }, select: { id: true } });
  if (!member) return { ok: false, message: "Nobody in AIESEC XP has that EXPA ID." };

  await db.privacyRequest.update({ where: { id: requestId }, data: { memberId: member.id } });
  await audit(admin.id, "PRIVACY_LINKED", requestId);
  revalidatePath("/admin/privacy");
  return { ok: true };
}

/** Honours an objection to the leaderboards, or lifts it. Points and rewards stay. */
export async function setHiddenFromBoards(
  requestId: string,
  hidden: boolean
): Promise<PrivacyActionResult> {
  const admin = await requireAdminLive();
  const request = await db.privacyRequest.findUnique({
    where: { id: requestId },
    select: { memberId: true },
  });
  if (!request?.memberId) return { ok: false, message: "Link this request to a member first." };

  await db.member.update({ where: { id: request.memberId }, data: { hiddenFromBoards: hidden } });
  await audit(admin.id, hidden ? "BOARDS_HIDDEN" : "BOARDS_SHOWN", requestId);
  revalidatePath("/admin/privacy");
  revalidatePath("/leaderboard");
  revalidatePath("/tv");
  return { ok: true };
}

/**
 * Irreversible. Removes the member's record and everything hanging off it, and
 * keeps them from being read back in from EXPA. The request itself stays, with
 * the member unlinked, as the record that it was carried out.
 */
export async function eraseRequester(
  requestId: string,
  confirmation: string
): Promise<PrivacyActionResult> {
  const admin = await requireAdminLive();
  if (confirmation !== "ERASE") return { ok: false, message: "Type ERASE to confirm." };

  const request = await db.privacyRequest.findUnique({
    where: { id: requestId },
    select: { memberId: true, kind: true },
  });
  if (!request?.memberId) return { ok: false, message: "Link this request to a member first." };
  if (request.memberId === admin.id) {
    return { ok: false, message: "Another admin has to erase your own record." };
  }

  await forgetMember(request.memberId, { tombstone: true });
  // Left open so the admin can still reply; closing it removes the reply address.
  await db.privacyRequest.update({ where: { id: requestId }, data: { status: "IN_PROGRESS" } });
  await audit(admin.id, "PRIVACY_ERASED", requestId);
  revalidatePath("/admin/privacy");
  return { ok: true };
}

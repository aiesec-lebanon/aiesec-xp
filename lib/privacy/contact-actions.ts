"use server";

import { headers } from "next/headers";

import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth/current-user";
import { logger } from "@/lib/logger";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";

import { type ContactState, RESPONSE_DAYS, validateContact } from "./contact";
import { ipRef } from "./refs";

// Public on purpose: a member who has left, or anyone shown on the office
// board, must still reach the privacy team without signing in. The database
// counts hold across server instances; the in-memory limit blunts bursts.
const PER_ADDRESS_PER_DAY = 5;
const OVERALL_PER_HOUR = 30;

const BUSY =
  "You've sent several messages already. We'll answer those first; try again tomorrow if you need to add something.";

export async function sendPrivacyMessage(
  _previous: ContactState,
  formData: FormData
): Promise<ContactState> {
  const checked = validateContact({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    expaId: formData.get("expaId") ?? "",
    kind: formData.get("kind") ?? "",
    message: formData.get("message") ?? "",
  });

  // People never see this field; bots fill it. Answer as if it went through.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot) {
    return { status: "sent", email: checked.ok ? checked.data.email : "" };
  }
  if (!checked.ok) {
    return { status: "error", error: "Some fields need fixing.", fieldErrors: checked.fieldErrors };
  }

  const ip = clientIp(await headers());
  const ipHash = ipRef(ip);
  if (!checkRateLimit("privacyContact", ip ?? "unknown").allowed) {
    return { status: "error", error: BUSY };
  }
  const [fromAddress, overall] = await Promise.all([
    ipHash
      ? db.privacyRequest.count({
          where: { ipHash, receivedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        })
      : Promise.resolve(0),
    db.privacyRequest.count({
      where: { receivedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    }),
  ]);
  if (fromAddress >= PER_ADDRESS_PER_DAY || overall >= OVERALL_PER_HOUR) {
    return { status: "error", error: BUSY };
  }

  // A signed-in sender has already shown who they are. Otherwise the EXPA ID
  // they typed is only a hint: an admin confirms it before acting on it.
  const user = await currentUser().catch(() => null);
  const { name, email, expaId, kind, message } = checked.data;

  const request = await db.privacyRequest.create({
    data: {
      memberId: user ? user.id : null,
      kind,
      senderName: name,
      replyEmail: email,
      message: expaId && !user ? `EXPA ID given: ${expaId}\n\n${message}` : message,
      ipHash,
      dueAt: new Date(Date.now() + RESPONSE_DAYS * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  logger.info("Privacy message received", { requestId: request.id, kind, linked: Boolean(user) });

  return { status: "sent", email };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth/guards";
import { safeReturnTo } from "@/lib/auth/oauth";

import { TV_CONSENT_VERSION } from "./tv-consent";

// The /tv board is public, so showing a member's name there rests on their
// consent: recorded with its time and the wording version, withdrawable any
// time from /me, and absent until they answer.
export async function setTvNameConsent(consent: boolean): Promise<void> {
  const user = await requireMember();
  const before = user.tvNameConsent;

  await db.$transaction([
    db.member.update({
      where: { id: user.id },
      data: { tvNameConsent: consent, tvConsentAt: new Date() },
    }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        action: consent ? "TV_CONSENT_GIVEN" : "TV_CONSENT_REFUSED",
        targetType: "Member",
        targetId: String(user.id),
        beforeJson: { tvNameConsent: before },
        afterJson: { tvNameConsent: consent, version: TV_CONSENT_VERSION },
      },
    }),
  ]);

  revalidatePath("/me");
  revalidatePath("/tv");
}

export async function answerTvConsent(formData: FormData): Promise<void> {
  await setTvNameConsent(formData.get("consent") === "yes");
  redirect(safeReturnTo(String(formData.get("returnTo") ?? "/")));
}

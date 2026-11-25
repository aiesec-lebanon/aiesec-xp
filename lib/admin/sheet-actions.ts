"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminLive } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export type ActionState = { ok: boolean; message: string };

// The sheet is configuration an admin enters, never something committed to
// the repository: its id is a capability on its own if the sheet is ever
// shared too widely.
const sheetSchema = z.object({
  sheet: z.string().trim().min(1, "Paste the sheet's link or its id."),
  tabName: z.string().trim().min(1, "Enter the name of the tab with the EPs.").max(100),
  managersTabName: z.string().trim().min(1, "Enter the name of the managers' tab.").max(100),
});

/** Accepts the address bar link or the bare id. */
export async function sheetIdFrom(input: string): Promise<string | null> {
  const fromLink = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(input)?.[1];
  const id = fromLink ?? input.trim();
  return /^[A-Za-z0-9_-]{20,}$/.test(id) ? id : null;
}

export async function saveSignupSheet(
  _previous: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdminLive();
  const parsed = sheetSchema.safeParse({
    sheet: formData.get("sheet"),
    tabName: formData.get("tabName"),
    managersTabName: formData.get("managersTabName"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the fields." };

  const spreadsheetId = await sheetIdFrom(parsed.data.sheet);
  if (!spreadsheetId) {
    return { ok: false, message: "That doesn't look like a Google Sheets link. Copy it from the address bar." };
  }

  const before = await db.assignmentSheet.findFirst({ where: { isActive: true } });
  await db.$transaction(async (tx) => {
    await tx.assignmentSheet.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await tx.assignmentSheet.upsert({
      where: { spreadsheetId },
      create: {
        label: "MC sign-up sheet",
        spreadsheetId,
        tabName: parsed.data.tabName,
        managersTabName: parsed.data.managersTabName,
        isActive: true,
      },
      update: { tabName: parsed.data.tabName, managersTabName: parsed.data.managersTabName, isActive: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "CONFIG_UPDATE",
        targetType: "AssignmentSheet",
        targetId: "active",
        beforeJson: before ? { tabName: before.tabName, managersTabName: before.managersTabName } : undefined,
        afterJson: { tabName: parsed.data.tabName, managersTabName: parsed.data.managersTabName, changedSheet: before?.spreadsheetId !== spreadsheetId },
      },
    });
  });

  revalidatePath("/admin/assignments");
  return { ok: true, message: "Saved. The sheet is read at the next refresh, or now with Import now." };
}

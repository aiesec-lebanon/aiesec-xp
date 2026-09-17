import "server-only";

import { db } from "@/lib/db";
import { defaultWindowRange, toDateInputValue } from "@/lib/admin/window";

export type WindowFormDefaults = {
  id: string | null;
  label: string;
  startsAt: string;
  endsAt: string;
  isDefault: boolean;
};

/** What the admin form shows: the active window, or the current month if the
 * admin has never set one. */
export async function activeWindowOrDefault(): Promise<WindowFormDefaults> {
  const window = await db.displayWindow.findFirst({ where: { isActive: true } });
  if (window) {
    return {
      id: window.id,
      label: window.label,
      startsAt: toDateInputValue(window.startsAt),
      endsAt: window.endsAt ? toDateInputValue(window.endsAt) : "",
      isDefault: false,
    };
  }

  const fallback = defaultWindowRange();
  return {
    id: null,
    label: "This month",
    startsAt: toDateInputValue(fallback.startsAt),
    endsAt: toDateInputValue(fallback.endsAt),
    isDefault: true,
  };
}

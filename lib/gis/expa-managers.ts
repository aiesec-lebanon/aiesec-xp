import "server-only";

import { db } from "@/lib/db";
import { mcOfficeId } from "@/lib/env";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";

// What EXPA itself records as an application's manager, read at display time so
// an admin can see where EXPA and the imported sheet disagree. Nothing here is
// stored (D-42), and EXPA populates the field only after approval, so it is
// absent for most applications.

export type ExpaManager = { id: bigint; fullName: string };

const PAGE_SIZE = 250;
const MAX_PAGES = 20;

/**
 * EP id to the managers EXPA records, across the active display window.
 *
 * One query per page rather than one per EP: the admin screen lists many EPs at
 * once and a per-row lookup would be a request storm against GIS.
 */
export async function expaManagersByEp(): Promise<Map<string, ExpaManager[]>> {
  const byEp = new Map<string, ExpaManager[]>();

  const [config, window] = await Promise.all([
    db.scoreConfig.findFirst({ where: { isActive: true } }),
    db.displayWindow.findFirst({ where: { isActive: true } }),
  ]);
  if (!config || !window) return byEp;

  const programmes = Object.keys(config.productWeights as Record<string, unknown>)
    .map(Number)
    .filter(Number.isInteger);

  const filters = {
    created_at: {
      from: window.startsAt.toISOString().slice(0, 10),
      to: (window.endsAt ?? new Date()).toISOString().slice(0, 10),
    },
    programmes,
    person_home_mc: [Number(mcOfficeId())],
  };

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await gis().ApplicationManagers({ filters, page, perPage: PAGE_SIZE });
      const body = result.allOpportunityApplication;

      for (const row of body?.data ?? []) {
        const epId = row?.person?.id;
        if (!epId) continue;

        const managers = (row.managers ?? []).flatMap((manager) =>
          manager?.id
            ? [{ id: BigInt(manager.id), fullName: manager.full_name ?? `Person ${manager.id}` }]
            : []
        );
        if (managers.length === 0) continue;

        const key = String(epId);
        const existing = byEp.get(key) ?? [];
        const merged = [...existing, ...managers];
        // The same EP can hold several applications, each with its own manager.
        byEp.set(
          key,
          merged.filter(
            (manager, index) => merged.findIndex((m) => m.id === manager.id) === index
          )
        );
      }

      if (page >= (body?.paging?.total_pages ?? 0)) break;
    }
  } catch (error) {
    // Degrades to showing nothing: this column is context for an admin, not
    // something the page depends on.
    logger.warn("Could not read EXPA managers", { error });
  }

  return byEp;
}

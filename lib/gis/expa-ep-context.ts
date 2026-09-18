import "server-only";

import { db } from "@/lib/db";
import { mcOfficeId } from "@/lib/env";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { termStart } from "@/lib/term";

// The EP behind an id, and what EXPA records as the application's manager, read
// at display time so an admin can tell who a row is about and see where EXPA
// and the imported sheet disagree. Nothing here is stored (D-42). EXPA
// populates the manager field only after approval, so it is absent for most
// applications.

export type ExpaManager = { id: bigint; fullName: string };

export type ExpaEpContext = {
  fullName: string | null;
  managers: ExpaManager[];
};

const PAGE_SIZE = 250;
const MAX_PAGES = 20;

/**
 * EP id to the name and managers EXPA records, across the whole term.
 *
 * One query per page rather than one per EP: the admin screen lists many EPs at
 * once and a per-row lookup would be a request storm against GIS. The range is
 * the term (D-58), because that is the floor the events themselves are
 * collected from — a display-window range would leave older rows nameless.
 */
export async function expaEpContext(): Promise<Map<string, ExpaEpContext>> {
  const byEp = new Map<string, ExpaEpContext>();

  const [config, from] = await Promise.all([
    db.scoreConfig.findFirst({ where: { isActive: true } }),
    termStart(),
  ]);
  if (!config) return byEp;

  const programmes = Object.keys(config.productWeights as Record<string, unknown>)
    .map(Number)
    .filter(Number.isInteger);

  const filters = {
    created_at: {
      from: from.toISOString().slice(0, 10),
      to: new Date().toISOString().slice(0, 10),
    },
    programmes,
    person_home_mc: [Number(mcOfficeId())],
  };

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await gis().ApplicationContext({ filters, page, perPage: PAGE_SIZE });
      const body = result.allOpportunityApplication;

      for (const row of body?.data ?? []) {
        const epId = row?.person?.id;
        if (!epId) continue;

        const key = String(epId);
        const entry = byEp.get(key) ?? { fullName: null, managers: [] };

        entry.fullName ??= row.person?.full_name ?? null;

        const managers = (row.managers ?? []).flatMap((manager) =>
          manager?.id
            ? [{ id: BigInt(manager.id), fullName: manager.full_name ?? `Person ${manager.id}` }]
            : []
        );
        // The same EP can hold several applications, each with its own manager.
        const merged = [...entry.managers, ...managers];
        entry.managers = merged.filter(
          (manager, index) => merged.findIndex((m) => m.id === manager.id) === index
        );

        byEp.set(key, entry);
      }

      if (page >= (body?.paging?.total_pages ?? 0)) break;
    }
  } catch (error) {
    // Degrades to showing ids alone: this is context for an admin, not
    // something the page depends on.
    logger.warn("Could not read EP context from EXPA", { error });
  }

  return byEp;
}

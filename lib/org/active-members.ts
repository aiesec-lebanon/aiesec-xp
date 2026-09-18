import "server-only";

import { toDateInputValue } from "@/lib/admin/window";
import { mcOfficeId } from "@/lib/env";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { termStart } from "@/lib/term";

// Reuses the named MemberPositions operation (gis/operations.graphql) rather
// than a new query, scoped to one office and status "active" only -- no
// subtree, no other status value (Architecture.md 4.4: every GIS call stays
// named and parameter-constrained). per_page: 1 is enough because the count
// this admin screen wants is paging.total_items, not the rows.

/** Count of active-role members in one entity, defaulting to the MC (182).
 * Counts the same roster the sync keeps (D-60): active status *and* a position
 * that has not already ended, so the figure next to the display window is not
 * inflated by last term's officers. */
export async function activeMemberCount(officeId: bigint = mcOfficeId()): Promise<number | null> {
  try {
    const result = await gis().MemberPositions({
      filters: {
        office_id: Number(officeId),
        status: ["active"],
        end_date: { from: toDateInputValue(await termStart()) },
      },
      pagination: { page: 1, per_page: 1 },
    });
    return result.memberPositions?.paging?.total_items ?? 0;
  } catch (error) {
    logger.warn("Could not read the active member count from GIS", { error });
    return null;
  }
}

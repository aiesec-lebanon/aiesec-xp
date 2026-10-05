import "server-only";

import { toDateInputValue } from "@/lib/admin/window";
import { mcOfficeId } from "@/lib/env";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { termStart } from "@/lib/term";

// Filters on end_date too, so last term's officers left "active" by EXPA aren't counted.
export async function activeMemberCount(officeId: bigint = mcOfficeId()): Promise<number | null> {
  try {
    const result = await gis().MemberPositions({
      filters: {
        office_id: Number(officeId),
        status: ["active"],
        end_date: { from: toDateInputValue(await termStart()) },
      },
      // Only paging.total_items is read.
      pagination: { page: 1, per_page: 1 },
    });
    return result.memberPositions?.paging?.total_items ?? 0;
  } catch (error) {
    logger.warn("Could not read the active member count from GIS", { error });
    return null;
  }
}

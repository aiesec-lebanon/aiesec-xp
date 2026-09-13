import "server-only";

import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";

// EP personal data lives in EXPA and only in EXPA (D-42). Anything that shows an
// EP -- the score audit trail (D-18), the assignment picker, the review queue --
// reads it through here, per view, and nothing it returns is ever written to the
// database.

export type EpDetail = {
  id: bigint;
  fullName: string;
  homeLcId: bigint | null;
  homeLcName: string | null;
};

const BATCH_SIZE = 200;

/**
 * Resolves EP ids to names for display.
 *
 * A missing id is simply absent from the result. Callers render a placeholder
 * rather than failing: an EP who has left GIS must not take a leaderboard down,
 * and the score itself never depended on the name.
 */
export async function resolveEpDetails(
  epPersonIds: readonly bigint[]
): Promise<Map<string, EpDetail>> {
  const unique = [...new Set(epPersonIds.map(String))];
  const resolved = new Map<string, EpDetail>();
  if (unique.length === 0) return resolved;

  for (let offset = 0; offset < unique.length; offset += BATCH_SIZE) {
    const batch = unique.slice(offset, offset + BATCH_SIZE);

    try {
      const result = await gis().EpDetails({ ids: batch });
      for (const person of result.people?.data ?? []) {
        if (!person?.id) continue;
        resolved.set(String(person.id), {
          id: BigInt(person.id),
          fullName: person.full_name ?? `Person ${person.id}`,
          homeLcId: person.home_lc?.id ? BigInt(person.home_lc.id) : null,
          homeLcName: person.home_lc?.name ?? null,
        });
      }
    } catch (error) {
      // Degrades rather than throws: a display lookup failing must not break the
      // page that was showing a score.
      logger.warn("Could not resolve EP details from GIS", { count: batch.length, error });
    }
  }

  return resolved;
}

export function epDisplayName(
  details: Map<string, EpDetail>,
  epPersonId: bigint
): string {
  return details.get(String(epPersonId))?.fullName ?? `EP ${epPersonId}`;
}

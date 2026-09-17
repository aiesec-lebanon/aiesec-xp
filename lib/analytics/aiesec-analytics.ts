import "server-only";

import { gisEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { countsFromPayload, type ProductFunnelCounts } from "@/lib/analytics/funnel-tags";

// AIESEC's Analytics API -- a separate REST product from GIS GraphQL, documented
// at aies.ec/developer-guides ("Using the AIESEC Analytics API"). It is what
// EXPA's own /analytics page calls, and its reference implementation is
// https://github.com/AIESEC-LK/aiesec-data/blob/master/functions/analytics.js.
//
// The endpoint takes the access token as a query parameter rather than an
// Authorization header. GIS_SERVICE_TOKEN is an AIESEC developer-application
// token good for both products, so it is reused here rather than adding a
// second secret; lib/logger.ts redacts it out of every log line regardless of
// which string it turns up in.
//
// This is a read-only, admin-facing sanity total -- "what does AIESEC's own
// dashboard say for this window" -- and feeds no scoring. Attribution and the
// visible leaderboard stay on the GIS sync pipeline (Architecture.md 6, 7),
// which is the only source that can join an event to a member.

const ANALYTICS_URL = "https://analytics.api.aiesec.org/v2/applications/analyze.json";
const REQUEST_TIMEOUT_MS = 15_000;

export type { FunnelCounts, ProductFunnelCounts } from "@/lib/analytics/funnel-tags";

export type AnalyticsQuery = {
  officeId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  programmeIds: readonly number[];
};

/**
 * Fetches APL/APD/RE application counts per product for an office and date
 * range. Returns null rather than throwing on any failure: this is a preview
 * panel on an admin screen, not something the window or reward it is next to
 * should fail to save over.
 */
export async function fetchFunnelAnalytics(query: AnalyticsQuery): Promise<ProductFunnelCounts | null> {
  const { GIS_SERVICE_TOKEN } = gisEnv();

  const params = new URLSearchParams({
    access_token: GIS_SERVICE_TOKEN,
    start_date: query.startDate,
    end_date: query.endDate,
  });
  params.set("performance_v3[office_id]", String(query.officeId));

  try {
    const response = await fetch(`${ANALYTICS_URL}?${params.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`analytics endpoint responded ${response.status}`);

    const payload = (await response.json()) as Record<string, unknown>;
    return countsFromPayload(payload, query.programmeIds);
  } catch (error) {
    logger.warn("Could not reach the AIESEC analytics API", { error });
    return null;
  }
}

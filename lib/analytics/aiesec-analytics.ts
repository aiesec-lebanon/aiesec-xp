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
// Attribution to an individual member still lives entirely on the GIS sync
// pipeline (Architecture.md 6, 7) -- this API returns office-wide aggregates
// with no per-person breakdown, so it can only ever describe an entity, never
// a member.

const ANALYTICS_URL = "https://analytics.api.aiesec.org/v2/applications/analyze.json";
const REQUEST_TIMEOUT_MS = 15_000;

export type { FunnelCounts, ProductFunnelCounts } from "@/lib/analytics/funnel-tags";

export type AnalyticsQuery = {
  officeId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  programmeIds: readonly number[];
};

async function fetchAnalyticsPayload(
  query: Omit<AnalyticsQuery, "programmeIds">
): Promise<Record<string, unknown> | null> {
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

    // Undocumented by the slide deck, confirmed live: the tags sit one level
    // deeper than the top-level JSON, under "response" (sibling to a cache
    // marker the deck never mentions either).
    const body = (await response.json()) as { response?: Record<string, unknown> };
    return body.response ?? {};
  } catch (error) {
    logger.warn("Could not reach the AIESEC analytics API", { error });
    return null;
  }
}

/**
 * Fetches APL/APD/RE application counts per product for an office and date
 * range. Returns null rather than throwing on any failure: this is a preview
 * panel on an admin screen, not something the window or reward it is next to
 * should fail to save over.
 */
export async function fetchFunnelAnalytics(query: AnalyticsQuery): Promise<ProductFunnelCounts | null> {
  const payload = await fetchAnalyticsPayload(query);
  if (!payload) return null;
  return countsFromPayload(payload, query.programmeIds);
}

export type EntityFunnelBreakdown = {
  /** The queried office's own total, across its whole subtree, per programme. */
  overall: ProductFunnelCounts;
  /** One entry per office id the response nests a nested section for. Verified
   * live against office 182: the queried office's own id shows up again as one
   * of these keys only when it has direct activity of its own in the window --
   * an office with none (including the queried office itself, D-56) carries no
   * key at all rather than a zeroed one. */
  byOffice: Record<string, ProductFunnelCounts>;
};

/** Per-entity, per-programme APL/APD/RE counts -- the same parse
 * `fetchFunnelAnalytics` does, kept per-programme and per-office instead of
 * collapsed so a caller (D-56: office-level scoring) can apply a per-product
 * point weight before summing. */
export async function fetchEntityFunnelBreakdown(query: AnalyticsQuery): Promise<EntityFunnelBreakdown | null> {
  const payload = await fetchAnalyticsPayload(query);
  if (!payload) return null;

  const overall = countsFromPayload(payload, query.programmeIds);
  const byOffice: EntityFunnelBreakdown["byOffice"] = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!/^\d+$/.test(key) || !value || typeof value !== "object") continue;
    byOffice[key] = countsFromPayload(value as Record<string, unknown>, query.programmeIds);
  }

  return { overall, byOffice };
}

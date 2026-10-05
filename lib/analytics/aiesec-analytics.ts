import "server-only";

import { gisEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { countsFromPayload, type ProductFunnelCounts } from "@/lib/analytics/funnel-tags";

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
  // This API takes the token in the query string; never log the URL (the logger redacts the token).
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

    // Undocumented: the tags sit one level down, under "response".
    const body = (await response.json()) as { response?: Record<string, unknown> };
    return body.response ?? {};
  } catch (error) {
    logger.warn("Could not reach the AIESEC analytics API", { error });
    return null;
  }
}

// Null rather than throwing: callers are preview panels that must not fail over it.
export async function fetchFunnelAnalytics(query: AnalyticsQuery): Promise<ProductFunnelCounts | null> {
  const payload = await fetchAnalyticsPayload(query);
  if (!payload) return null;
  return countsFromPayload(payload, query.programmeIds);
}

export type EntityFunnelBreakdown = {
  overall: ProductFunnelCounts;
  // An office with no direct activity in the range has no key at all, not a zeroed one.
  byOffice: Record<string, ProductFunnelCounts>;
};

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

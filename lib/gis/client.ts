import "server-only";

import { GraphQLClient } from "graphql-request";

import { gisEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getSdk } from "@/gis/generated";

// The only module in the product that reads GIS_SERVICE_TOKEN. Nothing here is
// exported that carries the token, and the SDK it returns exposes exactly the
// five operations in gis/operations.graphql -- there is no method that accepts
// a caller-supplied query (Architecture.md 4.4).

const REQUEST_TIMEOUT_MS = 15_000;

let cached: ReturnType<typeof getSdk> | null = null;

function createSdk() {
  const { GIS_GRAPHQL_URL, GIS_SERVICE_TOKEN } = gisEnv();

  const client = new GraphQLClient(GIS_GRAPHQL_URL, {
    // GIS wants the raw token; a Bearer prefix is rejected with invalid_token.
    headers: { Authorization: GIS_SERVICE_TOKEN },
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
  });

  return getSdk(client, async (action, operationName) => {
    const startedAt = Date.now();
    try {
      return await action();
    } catch (error) {
      // graphql-request attaches the failing request, headers included, to the
      // error. Logging it raw would print the token; redact() strips it.
      logger.error("GIS request failed", {
        operationName,
        elapsedMs: Date.now() - startedAt,
        error,
      });
      throw new GisError(`GIS operation ${operationName} failed`);
    }
  });
}

export class GisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GisError";
  }
}

export function gis() {
  cached ??= createSdk();
  return cached;
}

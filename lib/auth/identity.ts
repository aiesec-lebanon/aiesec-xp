import "server-only";

import { GraphQLClient } from "graphql-request";

import { gisEnv } from "@/lib/env";
import { getSdk, type CurrentPersonQuery } from "@/gis/generated";

export type GisIdentity = NonNullable<CurrentPersonQuery["currentPerson"]>;

const IDENTITY_TIMEOUT_MS = 10_000;

// The only call made with the user's own OAuth token; it is never returned, stored or logged.
export async function fetchIdentity(userAccessToken: string): Promise<GisIdentity> {
  const client = new GraphQLClient(gisEnv().GIS_GRAPHQL_URL, {
    headers: { Authorization: userAccessToken },
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS) }),
  });

  const result = await getSdk(client).CurrentPerson();
  if (!result.currentPerson) {
    throw new Error("GIS returned no currentPerson for the supplied token");
  }

  return result.currentPerson;
}

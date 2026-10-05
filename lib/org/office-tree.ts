import "server-only";

import { db } from "@/lib/db";
import { mcOfficeId } from "@/lib/env";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";

const ALIGNMENTS_URL = "https://gis-api.aiesec.org/v2/lists/mcs_alignments";
const ALIGNMENTS_TIMEOUT_MS = 10_000;
const MAX_DEPTH = 10;

type DiscoveredOffice = { id: bigint; name: string; parentId: bigint | null };

// Recurses committees() because the GIS schema has no root office field.
async function fetchSubtree(rootId: bigint): Promise<DiscoveredOffice[]> {
  const discovered = new Map<bigint, DiscoveredOffice>();
  let frontier = [rootId];

  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth += 1) {
    const page = await gis().OfficeChildren({ parentIds: frontier.map(Number) });
    const children = page.committees?.data ?? [];
    const next: bigint[] = [];

    for (const child of children) {
      if (!child?.id) continue;
      const id = BigInt(child.id);
      if (discovered.has(id)) continue;

      discovered.set(id, {
        id,
        name: child.name ?? `Office ${id}`,
        parentId: child.parent?.id ? BigInt(child.parent.id) : null,
      });
      next.push(id);
    }

    frontier = next;
  }

  return [...discovered.values()];
}

// Null on failure, so offices keep their existing flag rather than locking every member out.
async function fetchOperatingOfficeIds(mcName: string): Promise<Set<bigint> | null> {
  try {
    const response = await fetch(`${ALIGNMENTS_URL}?mc_name=${encodeURIComponent(mcName)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(ALIGNMENTS_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`alignments endpoint responded ${response.status}`);

    const body = (await response.json()) as Array<{
      id?: number;
      alignments?: Array<{ id?: number }>;
    }>;

    const ids = new Set<bigint>();
    for (const mc of body) {
      if (mc.id) ids.add(BigInt(mc.id));
      for (const alignment of mc.alignments ?? []) {
        if (alignment.id) ids.add(BigInt(alignment.id));
      }
    }
    return ids.size > 0 ? ids : null;
  } catch (error) {
    logger.warn("Could not read the alignments list; operating flags left unchanged", { error });
    return null;
  }
}

export type OfficeTreeSyncResult = {
  officesSeen: number;
  operatingIds: bigint[];
};

export async function syncOfficeTree(): Promise<OfficeTreeSyncResult> {
  const rootId = mcOfficeId();

  const identity = await gis().CurrentPerson();
  const rootName =
    identity.currentPerson?.current_positions?.find((p) => p?.office?.id === String(rootId))?.office
      ?.name ?? "Member Committee";

  const descendants = await fetchSubtree(rootId);
  const operating = await fetchOperatingOfficeIds(rootName);

  const offices = [{ id: rootId, name: rootName, parentId: null }, ...descendants];

  for (const office of offices) {
    const isMc = office.id === rootId;
    const isOperating = operating ? operating.has(office.id) || isMc : undefined;

    await db.office.upsert({
      where: { id: office.id },
      create: {
        id: office.id,
        name: office.name,
        parentId: office.parentId,
        isMc,
        isOperating: isOperating ?? isMc,
      },
      update: {
        name: office.name,
        parentId: office.parentId,
        isMc,
        ...(isOperating === undefined ? {} : { isOperating }),
      },
    });
  }

  return {
    officesSeen: offices.length,
    operatingIds: operating ? [...operating] : [],
  };
}

export async function operatingOfficeIds(): Promise<bigint[]> {
  const offices = await db.office.findMany({
    where: { isOperating: true },
    select: { id: true },
  });
  return offices.map((office) => office.id);
}

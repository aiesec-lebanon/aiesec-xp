import "server-only";

import { db } from "@/lib/db";
import { isActiveCredit, planSource, type AutomaticSource } from "@/lib/assignments/plan";
import { inTermRoles } from "@/lib/org/members";
import type { Assignment } from "@/lib/scoring/attribution";

// The assignment register (D-73): who is credited with each EP, from which
// source. The sync and the sheet import write it through `applySource`; the
// replay and the live leaderboards read it through `creditRegister`.

export const SYSTEM_ACTOR = 0n;

export type SourceResult = { created: number; flagged: number; cleared: number; dropped: number };

function flag(source: AutomaticSource, value: boolean) {
  return source === "EXPA" ? { fromExpa: value } : { fromSheet: value };
}

/**
 * Writes one automatic source's current view of the EPs in `desired` (EP id to
 * member ids). Anyone who is not a member this term is left out here rather
 * than failing the foreign key or crediting someone who cannot compete (D-71).
 * One transaction, so a replay never reads a half-applied source.
 */
export async function applySource(
  source: AutomaticSource,
  desired: ReadonlyMap<string, ReadonlySet<string>>,
  actorId: bigint = SYSTEM_ACTOR
): Promise<SourceResult> {
  if (desired.size === 0) return { created: 0, flagged: 0, cleared: 0, dropped: 0 };

  const creditable = await inTermRoles();
  const filtered = new Map(
    [...desired].map(([ep, members]) => [ep, new Set([...members].filter((m) => creditable.has(m)))])
  );

  const rows = await db.epAssignment.findMany({
    where: { epPersonId: { in: [...filtered.keys()].map(BigInt) } },
    select: {
      id: true,
      epPersonId: true,
      memberId: true,
      fromExpa: true,
      fromSheet: true,
      fromAdmin: true,
      isMain: true,
      removedAt: true,
    },
  });

  const plan = planSource(rows, filtered, source);

  await db.$transaction([
    db.epAssignment.createMany({
      data: plan.create.map((pair) => ({ ...pair, ...flag(source, true), createdBy: actorId })),
      skipDuplicates: true,
    }),
    db.epAssignment.updateMany({ where: { id: { in: plan.set } }, data: flag(source, true) }),
    db.epAssignment.updateMany({ where: { id: { in: plan.clear } }, data: flag(source, false) }),
    db.epAssignment.deleteMany({ where: { id: { in: plan.drop } } }),
  ]);

  return {
    created: plan.create.length,
    flagged: plan.set.length,
    cleared: plan.clear.length,
    dropped: plan.drop.length,
  };
}

export type CreditRegister = {
  /** The credits that count: not removed, named by a source, held by a member this term. */
  assignments: Assignment[];
  /** EP id to its main manager (D-83), including a main who is no longer a member. */
  mains: Map<string, bigint>;
};

/** What the engine scores with: each credit and the role it is weighted by, and each EP's main. */
export async function creditRegister(): Promise<CreditRegister> {
  const rows = await db.epAssignment.findMany({
    where: {
      removedAt: null,
      OR: [{ fromExpa: true }, { fromSheet: true }, { fromAdmin: true }, { isMain: true }],
    },
    select: {
      epPersonId: true,
      memberId: true,
      fromExpa: true,
      fromSheet: true,
      fromAdmin: true,
      isMain: true,
      removedAt: true,
    },
  });

  const roles = await inTermRoles([...new Set(rows.map((row) => row.memberId))]);
  const mains = new Map<string, bigint>();
  const assignments: Assignment[] = [];

  for (const row of rows) {
    if (row.isMain) mains.set(String(row.epPersonId), row.memberId);
    const key = String(row.memberId);
    if (!isActiveCredit(row) || !roles.has(key)) continue;
    assignments.push({ epPersonId: row.epPersonId, memberId: row.memberId, role: roles.get(key) ?? null });
  }

  return { assignments, mains };
}

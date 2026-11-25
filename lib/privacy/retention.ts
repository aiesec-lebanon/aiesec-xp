import "server-only";

import { db } from "@/lib/db";
import { hasNotEnded } from "@/lib/auth/roles";
import { gis } from "@/lib/gis/client";
import { logger } from "@/lib/logger";
import { operatingOfficeIds } from "@/lib/org/office-tree";
import { replay } from "@/lib/scoring/replay";
import { termStart } from "@/lib/term";

import { ERASED_ACTOR_ID, forgetMember } from "./member-data";

// The retention periods published in the privacy notice (and M2 Annex E).
// Change both together.
const DAY = 24 * 60 * 60 * 1000;
export const RETENTION_DAYS = {
  loginEvents: 90,
  refusedSignIns: 30,
  auditLog: 730,
  closedPrivacyRequests: 3 * 365,
  afterLastPosition: 365,
  /** Events and points are kept for the current term and 12 months before it. */
  beforeTermStart: 365,
} as const;

const EP_CHECK_BATCH = 100;

export type RetentionResult = Record<string, number>;

function ago(days: number, from = Date.now()): Date {
  return new Date(from - days * DAY);
}

/**
 * Members with no position that still holds: deleted 12 months after their last
 * position ended. Someone who was never a member here (a refused sign-in kept
 * before refusals stopped storing a profile) goes after 30 days.
 */
async function sweepMembers(dryRun: boolean): Promise<number> {
  const operating = new Set((await operatingOfficeIds()).map(String));
  const now = new Date();
  const members = await db.member.findMany({
    select: {
      id: true,
      lastSyncedAt: true,
      positions: { select: { officeId: true, status: true, endDate: true } },
      _count: { select: { ledgerEntries: true, assignments: true } },
    },
  });

  const due: bigint[] = [];
  for (const member of members) {
    const held = member.positions.filter((position) => operating.has(String(position.officeId)));
    const current = held.some(
      (position) => position.status.toLowerCase() === "active" && hasNotEnded(position, now)
    );
    if (current) continue;

    const neverMember = held.length === 0 && member._count.ledgerEntries === 0 && member._count.assignments === 0;
    const lastEnded = held.reduce<Date | null>(
      (latest, position) =>
        position.endDate && (!latest || position.endDate > latest) ? position.endDate : latest,
      null
    );
    const reference = lastEnded ?? member.lastSyncedAt;
    const limit = neverMember ? RETENTION_DAYS.refusedSignIns : RETENTION_DAYS.afterLastPosition;
    if (reference < ago(limit)) due.push(member.id);
  }

  if (!dryRun) {
    for (const id of due) await forgetMember(id, { tombstone: false, replay: false });
  }
  return due.length;
}

/** EP ids EXPA no longer returns: their events and credit go. */
async function sweepVanishedEps(dryRun: boolean): Promise<number> {
  const ids = (
    await db.exchangeEvent.findMany({ distinct: ["epPersonId"], select: { epPersonId: true } })
  ).map((row) => row.epPersonId);

  const vanished: bigint[] = [];
  for (let start = 0; start < ids.length; start += EP_CHECK_BATCH) {
    const batch = ids.slice(start, start + EP_CHECK_BATCH);
    try {
      const result = await gis().EpManagers({
        filters: { ids: batch.map(Number) },
        pagination: { page: 1, per_page: EP_CHECK_BATCH },
      });
      const found = new Set((result.people?.data ?? []).flatMap((person) => (person?.id ? [person.id] : [])));
      // An empty answer for a whole batch is more likely GIS failing than a
      // hundred people deleting their accounts at once.
      if (found.size === 0) continue;
      vanished.push(...batch.filter((id) => !found.has(String(id))));
    } catch (error) {
      logger.warn("Retention could not check EP ids against EXPA; skipped this batch", { error });
    }
  }

  if (!dryRun && vanished.length > 0) {
    await db.$transaction([
      db.exchangeEvent.deleteMany({ where: { epPersonId: { in: vanished } } }),
      db.epAssignment.deleteMany({ where: { epPersonId: { in: vanished } } }),
    ]);
  }
  return vanished.length;
}

export async function runRetention(dryRun = false): Promise<RetentionResult> {
  const counts: RetentionResult = {};
  const floor = await termStart();
  const earliestWindow = await db.displayWindow.findFirst({
    orderBy: { startsAt: "asc" },
    where: { isActive: true },
    select: { startsAt: true },
  });
  const keepFrom = new Date(
    Math.min(floor.getTime(), earliestWindow?.startsAt.getTime() ?? floor.getTime()) -
      RETENTION_DAYS.beforeTermStart * DAY
  );

  const run = async (name: string, count: () => Promise<number>, remove: () => Promise<{ count: number }>) => {
    counts[name] = dryRun ? await count() : (await remove()).count;
  };

  const loginWhere = { at: { lt: ago(RETENTION_DAYS.loginEvents) } };
  await run("loginEvents", () => db.loginEvent.count({ where: loginWhere }), () => db.loginEvent.deleteMany({ where: loginWhere }));

  const refusedWhere = { at: { lt: ago(RETENTION_DAYS.refusedSignIns) } };
  await run("refusedSignIns", () => db.refusedSignIn.count({ where: refusedWhere }), () => db.refusedSignIn.deleteMany({ where: refusedWhere }));

  const auditWhere = { createdAt: { lt: ago(RETENTION_DAYS.auditLog) } };
  await run("auditLog", () => db.auditLog.count({ where: auditWhere }), () => db.auditLog.deleteMany({ where: auditWhere }));

  const requestWhere = { closedAt: { lt: ago(RETENTION_DAYS.closedPrivacyRequests) } };
  await run("privacyRequests", () => db.privacyRequest.count({ where: requestWhere }), () => db.privacyRequest.deleteMany({ where: requestWhere }));

  // Events cascade to their ledger entries and anomalies.
  const eventWhere = { occurredAt: { lt: keepFrom } };
  await run("oldEvents", () => db.exchangeEvent.count({ where: eventWhere }), () => db.exchangeEvent.deleteMany({ where: eventWhere }));

  counts.members = await sweepMembers(dryRun);
  counts.vanishedEps = await sweepVanishedEps(dryRun);

  // Credit for EPs who no longer have any event left to score.
  const orphanCredit = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count FROM "EpAssignment" a
    WHERE a."updatedAt" < ${keepFrom}
      AND NOT EXISTS (SELECT 1 FROM "ExchangeEvent" e WHERE e."epPersonId" = a."epPersonId")`;
  counts.orphanCredit = Number(orphanCredit[0]?.count ?? 0);
  if (!dryRun && counts.orphanCredit > 0) {
    await db.$executeRaw`
      DELETE FROM "EpAssignment" a
      WHERE a."updatedAt" < ${keepFrom}
        AND NOT EXISTS (SELECT 1 FROM "ExchangeEvent" e WHERE e."epPersonId" = a."epPersonId")`;
  }

  const changedScores = counts.oldEvents + counts.members + counts.vanishedEps + counts.orphanCredit > 0;
  if (!dryRun && changedScores) {
    await replay(ERASED_ACTOR_ID);
  }

  logger.info("Retention sweep finished", { dryRun, ...counts });
  return counts;
}

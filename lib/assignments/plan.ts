// Pure rules for keeping the assignment register in line with an automatic
// source (D-73). Kept free of I/O so tests/assignment-plan.test.ts covers them.

export type AutomaticSource = "EXPA" | "SHEET";

export type RegisterRow = {
  id: string;
  epPersonId: bigint;
  memberId: bigint;
  fromExpa: boolean;
  fromSheet: boolean;
  fromAdmin: boolean;
  removedAt: Date | null;
};

export type SourcePlan = {
  create: { epPersonId: bigint; memberId: bigint }[];
  /** Rows the source now names, whose flag is not yet set. */
  set: string[];
  /** Rows the source no longer names but that stay: another source holds them, or an admin removed them. */
  clear: string[];
  /** Rows the source no longer names and nothing else holds. */
  drop: string[];
};

export function sourceFlag(source: AutomaticSource): "fromExpa" | "fromSheet" {
  return source === "EXPA" ? "fromExpa" : "fromSheet";
}

/**
 * Brings one source in line with what it says now about the EPs in `desired`
 * (EP id to member ids). An EP missing from `desired` is left alone, because a
 * source that could not be read says nothing about it -- an unreadable sheet
 * must not take anyone's credit away.
 *
 * An admin's removal is never undone here: a removed row may gain or lose a
 * source flag, but stays removed, and is kept rather than dropped so the next
 * sync cannot recreate it.
 */
export function planSource(
  rows: readonly RegisterRow[],
  desired: ReadonlyMap<string, ReadonlySet<string>>,
  source: AutomaticSource
): SourcePlan {
  const flag = sourceFlag(source);
  const byPair = new Map(rows.map((row) => [`${row.epPersonId}:${row.memberId}`, row]));
  const plan: SourcePlan = { create: [], set: [], clear: [], drop: [] };

  for (const [ep, members] of desired) {
    for (const member of members) {
      const row = byPair.get(`${ep}:${member}`);
      if (!row) plan.create.push({ epPersonId: BigInt(ep), memberId: BigInt(member) });
      else if (!row[flag]) plan.set.push(row.id);
    }
  }

  for (const row of rows) {
    if (!row[flag]) continue;
    const members = desired.get(String(row.epPersonId));
    if (!members || members.has(String(row.memberId))) continue;

    const heldElsewhere =
      row.fromAdmin || (source === "EXPA" ? row.fromSheet : row.fromExpa);
    if (heldElsewhere || row.removedAt) plan.clear.push(row.id);
    else plan.drop.push(row.id);
  }

  return plan;
}

/** A row counts while something still names it and no admin has removed it. */
export function isActiveCredit(row: Pick<RegisterRow, "fromExpa" | "fromSheet" | "fromAdmin" | "removedAt">): boolean {
  return row.removedAt === null && (row.fromExpa || row.fromSheet || row.fromAdmin);
}

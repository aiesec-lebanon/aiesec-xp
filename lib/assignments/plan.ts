export type AutomaticSource = "EXPA" | "SHEET";

export type RegisterRow = {
  id: string;
  epPersonId: bigint;
  memberId: bigint;
  fromExpa: boolean;
  fromSheet: boolean;
  fromAdmin: boolean;
  // The EP's main manager holds the row whatever the sources say.
  isMain: boolean;
  removedAt: Date | null;
};

export type SourcePlan = {
  create: { epPersonId: bigint; memberId: bigint }[];
  set: string[];
  // No longer named by this source, but kept: another source holds them, or an admin removed them.
  clear: string[];
  drop: string[];
};

function sourceFlag(source: AutomaticSource): "fromExpa" | "fromSheet" {
  return source === "EXPA" ? "fromExpa" : "fromSheet";
}

// An EP missing from `desired` is left alone: an unreadable source must not take anyone's credit away.
// Admin-removed rows are kept (not dropped) so the next sync cannot recreate them.
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
      row.fromAdmin || row.isMain || (source === "EXPA" ? row.fromSheet : row.fromExpa);
    if (heldElsewhere || row.removedAt) plan.clear.push(row.id);
    else plan.drop.push(row.id);
  }

  return plan;
}

export function isActiveCredit(
  row: Pick<RegisterRow, "fromExpa" | "fromSheet" | "fromAdmin" | "isMain" | "removedAt">
): boolean {
  return row.removedAt === null && (row.fromExpa || row.fromSheet || row.fromAdmin || row.isMain);
}

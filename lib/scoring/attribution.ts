// Who earns an EP's points. Attribution is per EP, not per application, so one
// EP's APL, APD and RE credit the same members by construction.

/**
 * One member credited with one EP, and the role they share its points under
 * (D-73). The caller passes only credits that count: not removed, from a live
 * source, held by a member this term (D-71).
 *
 * There is no effective date. Credit is whoever holds the EP now, which is
 * what mirroring EXPA's managers means (D-74) and what an admin sees on the
 * console; D-36's dated assignments are superseded.
 */
export type Assignment = {
  epPersonId: bigint;
  memberId: bigint;
  role: string | null;
};

/** Credits per EP, one per member however many sources named them. */
export function indexAssignments(assignments: readonly Assignment[]): Map<string, Assignment[]> {
  const byEp = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    const key = String(assignment.epPersonId);
    const bucket = byEp.get(key) ?? [];
    if (!bucket.some((existing) => existing.memberId === assignment.memberId)) {
      bucket.push(assignment);
    }
    byEp.set(key, bucket);
  }
  return byEp;
}

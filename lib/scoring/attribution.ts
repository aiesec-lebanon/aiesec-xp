// Attribution is per EP, not per application, and undated: credit is whoever holds the EP now.
export type Assignment = {
  epPersonId: bigint;
  memberId: bigint;
  role: string | null;
};

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

// Who earns the points for an event. Strategies are tried in order and the
// first that claims the event wins, so adopting a different source later means
// adding a strategy rather than editing a decision.

export type AttributionEvent = {
  applicationId: bigint;
  epPersonId: bigint;
  occurredAt: Date;
};

export type Assignment = {
  epPersonId: bigint;
  memberId: bigint;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type AttributionContext = {
  /** Indexed by EP, because attribution is per EP and not per application. */
  assignmentsByEp: ReadonlyMap<string, readonly Assignment[]>;
};

export interface AttributionStrategy {
  readonly name: string;
  /** Members who earn this event, or an empty array to defer to the next strategy. */
  attribute(event: AttributionEvent, context: AttributionContext): bigint[];
}

/**
 * The register imported from the MC's sheet (D-44).
 *
 * An assignment counts only if it was in force when the event occurred (D-36),
 * which is what keeps a reassignment from silently rewriting who earned a point
 * last month. Concurrent assignees each receive full points (D-06), so this
 * returns every match rather than picking one.
 */
export const epAssignmentStrategy: AttributionStrategy = {
  name: "EP_ASSIGNMENT",
  attribute(event, { assignmentsByEp }) {
    const candidates = assignmentsByEp.get(String(event.epPersonId)) ?? [];

    const members = candidates
      .filter(
        (assignment) =>
          assignment.effectiveFrom <= event.occurredAt &&
          (assignment.effectiveTo === null || assignment.effectiveTo > event.occurredAt)
      )
      .map((assignment) => assignment.memberId);

    return [...new Set(members.map(String))].map(BigInt);
  },
};

/**
 * Terminal. Claims nothing, so an unattributed event is recorded and surfaced
 * rather than dropped: points nobody earned are a queue item, not a silence.
 */
export const unattributedStrategy: AttributionStrategy = {
  name: "UNATTRIBUTED",
  attribute() {
    return [];
  },
};

export const DEFAULT_CHAIN: readonly AttributionStrategy[] = [
  epAssignmentStrategy,
  unattributedStrategy,
];

export type AttributionResult = {
  memberIds: bigint[];
  strategy: string;
};

export function attribute(
  event: AttributionEvent,
  context: AttributionContext,
  chain: readonly AttributionStrategy[] = DEFAULT_CHAIN
): AttributionResult {
  for (const strategy of chain) {
    const memberIds = strategy.attribute(event, context);
    if (memberIds.length > 0) return { memberIds, strategy: strategy.name };
  }
  return { memberIds: [], strategy: "UNATTRIBUTED" };
}

export function indexAssignments(
  assignments: readonly Assignment[]
): Map<string, Assignment[]> {
  const byEp = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    const key = String(assignment.epPersonId);
    const bucket = byEp.get(key);
    if (bucket) bucket.push(assignment);
    else byEp.set(key, [assignment]);
  }
  return byEp;
}

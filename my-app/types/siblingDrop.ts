/** How a drag slot maps to DB after reparent (sibling row uses `job_position` ordering). */
export type SiblingDropPlacement =
  | { kind: 'below' }
  | { kind: 'between'; leftId: string; rightId: string }
  | { kind: 'first' }
  | { kind: 'last' };

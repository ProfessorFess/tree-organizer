export type CreateIntent =
  | { kind: 'root' }
  | { kind: 'child'; parentId: string }
  | { kind: 'sibling'; parentId: string }
  | { kind: 'insertAbove'; anchorId: string };

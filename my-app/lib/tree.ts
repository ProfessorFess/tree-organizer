import { Node } from '../types/database';

/** Single project root in DB, else first row (legacy). */
export function getRootNode(nodes: Node[]): Node | null {
  if (nodes.length === 0) return null;
  const root = nodes.find((n) => n.node_type === 'ROOT');
  return root ?? nodes[0];
}

export function getChildNodes(nodes: Node[], root: Node | null): Node[] {
  if (!root) return [];
  return nodes.filter((n) => n.id !== root.id);
}

export function childrenByParent(nodes: Node[]): Map<string, Node[]> {
  const map = new Map<string, Node[]>();
  for (const n of nodes) {
    const key = n.parent_node_id ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  for (const [, list] of map) {
    list.sort(compareSiblingOrder);
  }
  return map;
}

function parseSiblingRank(jobPosition: string | null | undefined): number | null {
  if (jobPosition == null || String(jobPosition).trim() === '') return null;
  const t = String(jobPosition).trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return null;
}

/** Sort siblings: numeric `job_position` first, then label, then id. */
export function compareSiblingOrder(a: Node, b: Node): number {
  const ra = parseSiblingRank(a.job_position);
  const rb = parseSiblingRank(b.job_position);
  if (ra !== null && rb !== null && ra !== rb) return ra - rb;
  if (ra !== null && rb === null) return -1;
  if (ra === null && rb !== null) return 1;
  return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
}

/** IDs reachable from root (including root). Orphans excluded. */
export function reachableFromRoot(nodes: Node[], root: Node | null): Set<string> {
  const ids = new Set<string>();
  if (!root) return ids;
  const map = childrenByParent(nodes);
  const stack = [root.id];
  ids.add(root.id);
  while (stack.length) {
    const id = stack.pop()!;
    const kids = map.get(id) ?? [];
    for (const k of kids) {
      if (!ids.has(k.id)) {
        ids.add(k.id);
        stack.push(k.id);
      }
    }
  }
  return ids;
}

/** Visual diameter of each tree node circle. */
export const TREE_NODE_SIZE = 64;
/** Padding around the circle for hover hit area and (+) affordances (tight ≈ gap + plus size). */
export const TREE_PLUS_ARM = 28;
/** Clearance between connector line endpoints and each node circle. */
export const TREE_LINE_EDGE_GAP = 8;
/** Vertical gap between parent row and child row. */
export const TREE_V_GAP = 118;
/** Horizontal gap between sibling subtrees (same as vertical level gap). */
export const TREE_H_GAP = TREE_V_GAP;
export const TREE_TOP_PAD = 28;

function measureSubtreeWidth(
  nodeId: string,
  map: Map<string, Node[]>
): number {
  const kids = map.get(nodeId) ?? [];
  if (kids.length === 0) return TREE_NODE_SIZE;
  const parts = kids.map((c) => measureSubtreeWidth(c.id, map));
  const sum =
    parts.reduce((a, b) => a + b, 0) + TREE_H_GAP * Math.max(0, kids.length - 1);
  return Math.max(TREE_NODE_SIZE, sum);
}

/** Top-down positions: root centered at top, children on rows below. */
export function layoutTreeDownward(
  nodes: Node[],
  root: Node | null,
  viewportWidth: number
): { positions: Map<string, { left: number; top: number }>; contentWidth: number; contentHeight: number } {
  const positions = new Map<string, { left: number; top: number }>();
  if (!root || viewportWidth < TREE_NODE_SIZE) {
    return {
      positions,
      contentWidth: viewportWidth,
      contentHeight: TREE_TOP_PAD + TREE_NODE_SIZE + TREE_PLUS_ARM + 48,
    };
  }

  const map = childrenByParent(nodes);
  const totalW = measureSubtreeWidth(root.id, map);
  const contentWidth = Math.max(viewportWidth, totalW + 48 + TREE_PLUS_ARM * 2);
  const rootCenterX = contentWidth / 2;

  function assign(nodeId: string, centerX: number, y: number): void {
    positions.set(nodeId, {
      left: centerX - TREE_NODE_SIZE / 2,
      top: y,
    });
    const kids = map.get(nodeId) ?? [];
    if (kids.length === 0) return;

    const widths = kids.map((c) => measureSubtreeWidth(c.id, map));
    const rowW =
      widths.reduce((a, b) => a + b, 0) + TREE_H_GAP * Math.max(0, kids.length - 1);
    let startX = centerX - rowW / 2;
    for (let i = 0; i < kids.length; i++) {
      const w = widths[i];
      const cx = startX + w / 2;
      assign(kids[i].id, cx, y + TREE_V_GAP);
      startX += w + TREE_H_GAP;
    }
  }

  assign(root.id, rootCenterX, TREE_TOP_PAD);

  let maxBottom = TREE_TOP_PAD + TREE_NODE_SIZE;
  for (const p of positions.values()) {
    maxBottom = Math.max(maxBottom, p.top + TREE_NODE_SIZE + TREE_PLUS_ARM + 56);
  }

  return {
    positions,
    contentWidth,
    contentHeight: maxBottom,
  };
}

export function flattenTreePreOrder(nodes: Node[], root: Node | null): Node[] {
  if (!root) return [];
  const map = childrenByParent(nodes);
  const out: Node[] = [];
  function walk(id: string) {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    out.push(n);
    for (const c of map.get(id) ?? []) walk(c.id);
  }
  walk(root.id);
  return out;
}

/** All node ids in the subtree rooted at `rootId` (including `rootId`). */
export function subtreeNodeIds(nodes: Node[], rootId: string): Set<string> {
  const cmap = childrenByParent(nodes);
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of cmap.get(id) ?? []) stack.push(c.id);
  }
  return out;
}

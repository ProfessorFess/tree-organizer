import {
  StyleSheet,
  View,
  Pressable,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { TreeNode, TreeAddDirection } from './TreeNode';
import { Node } from '../types/database';
import {
  getRootNode,
  layoutTreeDownward,
  reachableFromRoot,
  childrenByParent,
  subtreeNodeIds,
  TREE_NODE_SIZE,
  TREE_LINE_EDGE_GAP,
  TREE_V_GAP,
} from '../lib/tree';
import type { CreateIntent } from '../types/createIntent';
import type { SiblingDropPlacement } from '../types/siblingDrop';
import { nodeService } from '../services/nodeService';

/** Inner radius from node center: inside = swap with that node; outside = slots / no drop. */
const SWAP_SNAP_PX = 22;
/** Shared radius for all non-swap drag slot circles. */
const DRAG_SLOT_R = 12;
/** Min vertical gap (parent rim → child row) needed to show a below circle. */
const BELOW_MIN_GAP = 20;
/** Min horizontal gap between two sibling circles to place one between-slot. */
const BETWEEN_MIN_GAP = 18;
/** End-cap circles: reparent as sibling of that row (same parent). */
const OUTER_SLOT_OUTSET = 16;

type SlotDef = {
  key: string;
  cx: number;
  cy: number;
  r: number;
  /** New parent id for `reparentNode` (below = anchor node id; sibling slots = shared parent id). */
  reparentParentId: string;
  placement: SiblingDropPlacement;
};

function pointInSlotCircle(px: number, py: number, s: SlotDef): boolean {
  const dx = px - s.cx;
  const dy = py - s.cy;
  return dx * dx + dy * dy <= s.r * s.r;
}

function buildDragSlots(
  nodes: Node[],
  positions: Map<string, { left: number; top: number }>,
  reachable: Set<string>,
  dragId: string,
  rootNodeId: string | null
): SlotDef[] {
  if (!rootNodeId) return [];
  const dragNode = nodes.find((n) => n.id === dragId);
  if (!dragNode || dragNode.node_type === 'ROOT') return [];

  const forbidden = subtreeNodeIds(nodes, dragId);
  const cmap = childrenByParent(nodes);

  const canReparentUnder = (newParentId: string) =>
    newParentId !== dragId && !forbidden.has(newParentId);

  const slots: SlotDef[] = [];

  for (const n of nodes) {
    if (n.id === dragId) continue;
    if (!reachable.has(n.id)) continue;
    const pos = positions.get(n.id);
    if (!pos) continue;

    if (canReparentUnder(n.id)) {
      const vGap = TREE_V_GAP - TREE_NODE_SIZE;
      if (vGap >= BELOW_MIN_GAP) {
        const cx = pos.left + TREE_NODE_SIZE / 2;
        const cy = pos.top + TREE_NODE_SIZE + vGap / 2;
        if ((vGap - 6) / 2 >= DRAG_SLOT_R) {
          slots.push({
            key: `${n.id}:below`,
            cx,
            cy,
            r: DRAG_SLOT_R,
            reparentParentId: n.id,
            placement: { kind: 'below' },
          });
        }
      }
    }
  }

  for (const [pid, kids] of cmap) {
    if (!pid || kids.length < 2) continue;
    if (!canReparentUnder(pid)) continue;

    for (let i = 0; i < kids.length - 1; i++) {
      const a = kids[i];
      const b = kids[i + 1];
      if (a.id === dragId || b.id === dragId) continue;
      if (!reachable.has(a.id) || !reachable.has(b.id)) continue;
      const pa = positions.get(a.id);
      const pb = positions.get(b.id);
      if (!pa || !pb) continue;
      const hGap = pb.left - (pa.left + TREE_NODE_SIZE);
      if (hGap < BETWEEN_MIN_GAP) continue;
      if (hGap / 2 - 2 < DRAG_SLOT_R) continue;

      const cx = (pa.left + TREE_NODE_SIZE + pb.left) / 2;
      const cy = pa.top + TREE_NODE_SIZE / 2;

      slots.push({
        key: `between:${pid}:${a.id}:${b.id}`,
        cx,
        cy,
        r: DRAG_SLOT_R,
        reparentParentId: pid,
        placement: { kind: 'between', leftId: a.id, rightId: b.id },
      });
    }
  }

  for (const [pid, kids] of cmap) {
    if (!pid || kids.length === 0) continue;
    if (!canReparentUnder(pid)) continue;

    const first = kids[0];
    const last = kids[kids.length - 1];

    if (first.id !== dragId && reachable.has(first.id)) {
      const pf = positions.get(first.id);
      if (pf) {
        slots.push({
          key: `outerL:${pid}:${first.id}`,
          cx: pf.left - OUTER_SLOT_OUTSET - DRAG_SLOT_R,
          cy: pf.top + TREE_NODE_SIZE / 2,
          r: DRAG_SLOT_R,
          reparentParentId: pid,
          placement: { kind: 'first' },
        });
      }
    }
    if (last.id !== dragId && reachable.has(last.id)) {
      const pl = positions.get(last.id);
      if (pl) {
        slots.push({
          key: `outerR:${pid}:${last.id}`,
          cx: pl.left + TREE_NODE_SIZE + OUTER_SLOT_OUTSET + DRAG_SLOT_R,
          cy: pl.top + TREE_NODE_SIZE / 2,
          r: DRAG_SLOT_R,
          reparentParentId: pid,
          placement: { kind: 'last' },
        });
      }
    }
  }

  return slots;
}

type DragPointerPreview =
  | { kind: 'swap'; targetId: string }
  | { kind: 'slot'; key: string }
  | null;

type DragResolution =
  | { kind: 'swap'; targetId: string }
  | { kind: 'slot'; key: string; reparentParentId: string; placement: SiblingDropPlacement };

function pickDragResolution(
  nodes: Node[],
  positions: Map<string, { left: number; top: number }>,
  dragId: string,
  dx: number,
  dy: number,
  rootNodeId: string | null,
  slots: SlotDef[],
  /** Pointer in canvas layout coords; if null, uses dragged node center + translation. */
  pointerCanvas: { px: number; py: number } | null
): DragResolution | null {
  if (!rootNodeId) return null;
  const forbidden = subtreeNodeIds(nodes, dragId);
  const p0 = positions.get(dragId);
  if (!p0) return null;
  const R = TREE_NODE_SIZE / 2;
  const px = pointerCanvas ? pointerCanvas.px : p0.left + R + dx;
  const py = pointerCanvas ? pointerCanvas.py : p0.top + R + dy;

  let bestSwap: { targetId: string; dist: number } | null = null;
  for (const n of nodes) {
    if (n.id === dragId) continue;
    if (forbidden.has(n.id)) continue;
    if (n.node_type === 'ROOT' || n.id === rootNodeId) continue;
    const pos = positions.get(n.id);
    if (!pos) continue;
    const cx = pos.left + R;
    const cy = pos.top + R;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < SWAP_SNAP_PX && (!bestSwap || dist < bestSwap.dist)) {
      bestSwap = { targetId: n.id, dist };
    }
  }
  if (bestSwap) {
    return { kind: 'swap', targetId: bestSwap.targetId };
  }

  let bestSlot: { s: SlotDef; dist: number } | null = null;
  for (const s of slots) {
    if (!pointInSlotCircle(px, py, s)) continue;
    const dist = Math.hypot(px - s.cx, py - s.cy);
    if (!bestSlot || dist < bestSlot.dist) {
      bestSlot = { s, dist };
    }
  }
  if (bestSlot) {
    return {
      kind: 'slot',
      key: bestSlot.s.key,
      reparentParentId: bestSlot.s.reparentParentId,
      placement: bestSlot.s.placement,
    };
  }

  return null;
}

function toPreview(res: DragResolution | null): DragPointerPreview {
  if (!res) return null;
  if (res.kind === 'swap') return { kind: 'swap', targetId: res.targetId };
  return { kind: 'slot', key: res.key };
}

function TreeEdge({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <View
      style={[
        styles.edge,
        {
          left: midX - length / 2,
          top: midY - 0.75,
          width: length,
          transform: [{ rotate: `${angle}deg` }],
          pointerEvents: 'none',
        },
      ]}
    />
  );
}

const dotBackground = Platform.select({
  web: {
    backgroundImage:
      'radial-gradient(circle, #333 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  } as any,
  default: {},
});

/**
 * Map pointer position (gesture `absoluteX` / `absoluteY`) into canvas layout space used by `positions`.
 * On web, DOM `getBoundingClientRect` matches pointer events; `measureInWindow` can disagree.
 */
function pointerToCanvasLayout(
  canvasHost: View | null,
  absX: number,
  absY: number,
  onResult: (p: { px: number; py: number } | null) => void
): void {
  if (!canvasHost) {
    onResult(null);
    return;
  }
  if (Platform.OS === 'web') {
    const el = canvasHost as unknown as HTMLElement;
    if (typeof el.getBoundingClientRect === 'function') {
      const r = el.getBoundingClientRect();
      onResult({ px: absX - r.left, py: absY - r.top });
      return;
    }
  }
  canvasHost.measureInWindow((wx, wy) => {
    onResult({ px: absX - wx, py: absY - wy });
  });
}

type WorkspaceProps = {
  nodes: Node[];
  projectName: string;
  onNodePress: (node: Node) => void;
  onRequestCreate: (intent: CreateIntent) => void;
  onTreeReload: () => Promise<void>;
};

export function Workspace({
  nodes,
  projectName,
  onNodePress,
  onRequestCreate,
  onTreeReload,
}: WorkspaceProps) {
  const [viewportWidth, setViewportWidth] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [dragPointerPreview, setDragPointerPreview] = useState<DragPointerPreview>(null);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const positionsRef = useRef<Map<string, { left: number; top: number }>>(new Map());
  const rootIdRef = useRef<string | null>(null);
  /** Tree layout coordinates origin: used with pointer window coords from the drag gesture. */
  const canvasRef = useRef<View | null>(null);

  const rootNode = useMemo(() => getRootNode(nodes), [nodes]);
  const reachable = useMemo(
    () => reachableFromRoot(nodes, rootNode),
    [nodes, rootNode]
  );

  const { positions, contentWidth, contentHeight } = useMemo(
    () => layoutTreeDownward(nodes, rootNode, Math.max(viewportWidth, 320)),
    [nodes, rootNode, viewportWidth]
  );
  positionsRef.current = positions;
  rootIdRef.current = rootNode?.id ?? null;

  const edges = useMemo(() => {
    const list: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    if (!rootNode) return list;
    const cmap = childrenByParent(nodes);
    const R = TREE_NODE_SIZE / 2;
    const g = TREE_LINE_EDGE_GAP;
    for (const [pid, kids] of cmap) {
      if (!pid) continue;
      const p = positions.get(pid);
      if (!p) continue;
      const px0 = p.left + R;
      const py0 = p.top + R;
      for (const k of kids) {
        if (!reachable.has(k.id)) continue;
        const c = positions.get(k.id);
        if (!c) continue;
        const cx0 = c.left + R;
        const cy0 = c.top + R;
        let vx = cx0 - px0;
        let vy = cy0 - py0;
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        vx /= len;
        vy /= len;
        const x1 = px0 + vx * (R + g);
        const y1 = py0 + vy * (R + g);
        const x2 = cx0 - vx * (R + g);
        const y2 = cy0 - vy * (R + g);
        list.push({
          key: `${pid}-${k.id}`,
          x1,
          y1,
          x2,
          y2,
        });
      }
    }
    return list;
  }, [nodes, positions, rootNode, reachable]);

  const handleLayout = (e: LayoutChangeEvent) => {
    setViewportWidth(e.nativeEvent.layout.width);
  };

  const onTreeDragClear = useCallback(() => {
    setDrag(null);
    setDragPointerPreview(null);
  }, []);

  const onTreeDragBegin = useCallback((id: string) => {
    setHoveredNodeId(null);
    setDrag({ id, dx: 0, dy: 0 });
  }, []);

  const dragSlots = useMemo(() => {
    if (!drag) return [] as SlotDef[];
    return buildDragSlots(
      nodes,
      positions,
      reachable,
      drag.id,
      rootNode?.id ?? null
    );
  }, [drag, nodes, positions, reachable, rootNode?.id]);

  const dragSlotsRef = useRef<SlotDef[]>([]);
  useEffect(() => {
    dragSlotsRef.current = dragSlots;
  }, [dragSlots]);

  const onTreeDragMove = useCallback((id: string, dx: number, dy: number, absX?: number, absY?: number) => {
    setDrag({ id, dx, dy });
    const applyPreview = (pointer: { px: number; py: number } | null) => {
      const res = pickDragResolution(
        nodesRef.current,
        positionsRef.current,
        id,
        dx,
        dy,
        rootIdRef.current,
        dragSlotsRef.current,
        pointer
      );
      setDragPointerPreview(toPreview(res));
    };
    if (absX == null || absY == null) {
      applyPreview(null);
      return;
    }
    pointerToCanvasLayout(canvasRef.current, absX, absY, applyPreview);
  }, []);

  const completeTreeDrag = useCallback(
    (id: string, dx: number, dy: number, absX?: number, absY?: number) => {
      const finish = (pointer: { px: number; py: number } | null) => {
        const res = pickDragResolution(
          nodesRef.current,
          positionsRef.current,
          id,
          dx,
          dy,
          rootIdRef.current,
          dragSlotsRef.current,
          pointer
        );
        setDrag(null);
        setDragPointerPreview(null);
        if (!res) return;
        void (async () => {
          try {
            if (res.kind === 'swap') {
              await nodeService.swapNodes(id, res.targetId);
            } else {
              await nodeService.reparentWithSiblingPlacement(id, res.reparentParentId, res.placement);
            }
            await onTreeReload();
          } catch (e) {
            console.error(e);
          }
        })();
      };
      if (absX == null || absY == null) {
        finish(null);
        return;
      }
      pointerToCanvasLayout(canvasRef.current, absX, absY, finish);
    },
    [onTreeReload]
  );

  const treeDragActive = !!drag;

  const handleTreeAdd = (dir: TreeAddDirection, node: Node) => {
    const isHub = !!rootNode && node.id === rootNode.id;
    if (isHub) {
      if (dir === 'down') {
        onRequestCreate({ kind: 'child', parentId: node.id });
      }
      return;
    }
    if (dir === 'down') {
      onRequestCreate({ kind: 'child', parentId: node.id });
      return;
    }
    if (dir === 'up') {
      onRequestCreate({ kind: 'insertAbove', anchorId: node.id });
      return;
    }
    if ((dir === 'left' || dir === 'right') && node.parent_node_id) {
      onRequestCreate({ kind: 'sibling', parentId: node.parent_node_id });
    }
  };

  const fabIntent: CreateIntent = rootNode
    ? { kind: 'child', parentId: rootNode.id }
    : { kind: 'root' };

  const rootLayoutPos =
    rootNode && reachable.has(rootNode.id)
      ? positions.get(rootNode.id) ?? null
      : null;

  return (
    <View style={[styles.container, dotBackground]} onLayout={handleLayout}>
      <ScrollView
        horizontal
        style={styles.scroll}
        contentContainerStyle={{ minWidth: contentWidth }}
        showsHorizontalScrollIndicator
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ minHeight: contentHeight }}
          showsVerticalScrollIndicator
        >
          <View
            ref={canvasRef}
            style={[styles.canvas, { width: contentWidth, height: contentHeight }]}
          >
          <View
            style={[
              StyleSheet.absoluteFill,
              { pointerEvents: 'none', opacity: treeDragActive ? 0 : 1 },
            ]}
          >
            {edges.map((e) => (
              <TreeEdge key={e.key} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
            ))}
          </View>

          {treeDragActive &&
            dragSlots.map((s) => {
              const d = s.r * 2;
              const slotTargeted =
                dragPointerPreview?.kind === 'slot' && dragPointerPreview.key === s.key;
              return (
                <View
                  key={s.key}
                  style={[
                    styles.dragSlot,
                    {
                      left: s.cx - s.r,
                      top: s.cy - s.r,
                      width: d,
                      height: d,
                      borderRadius: s.r,
                      pointerEvents: 'none',
                      ...(Platform.OS === 'web'
                        ? ({ outlineStyle: 'none' as const, outlineWidth: 0 } as const)
                        : {}),
                    },
                    slotTargeted && styles.dragSlotTargeted,
                  ]}
                />
              );
            })}

          {rootNode && rootLayoutPos && (
            <TreeNode
              key={rootNode.id}
              node={rootNode}
              circleLeft={rootLayoutPos.left}
              circleTop={rootLayoutPos.top}
              displayLabel={projectName}
              isProjectRoot
              hoveredNodeId={hoveredNodeId}
              onHoverChange={setHoveredNodeId}
              onNodePress={onNodePress}
              onAddPress={handleTreeAdd}
              treeDragActive={treeDragActive}
              dragOffset={drag?.id === rootNode.id ? { dx: drag.dx, dy: drag.dy } : null}
            />
          )}

          {nodes.map((node) => {
            if (!rootNode || node.id === rootNode.id) return null;
            if (!reachable.has(node.id)) return null;
            const p = positions.get(node.id);
            if (!p) return null;
            return (
              <TreeNode
                key={node.id}
                node={node}
                circleLeft={p.left}
                circleTop={p.top}
                isProjectRoot={false}
                hoveredNodeId={hoveredNodeId}
                onHoverChange={setHoveredNodeId}
                onNodePress={onNodePress}
                onAddPress={handleTreeAdd}
                treeDragActive={treeDragActive}
                dragOffset={drag?.id === node.id ? { dx: drag.dx, dy: drag.dy } : null}
                swapDropTarget={
                  dragPointerPreview?.kind === 'swap' &&
                  dragPointerPreview.targetId === node.id
                }
                onTreeDragBegin={onTreeDragBegin}
                onTreeDragMove={onTreeDragMove}
                onTreeDragComplete={completeTreeDrag}
                onTreeDragClear={onTreeDragClear}
              />
            );
          })}
          </View>
        </ScrollView>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => onRequestCreate(fabIntent)}>
        <MaterialIcons name="add" size={20} color="#a1a1aa" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0e10',
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  canvas: {
    position: 'relative',
    overflow: 'visible',
  } as any,
  edge: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: '#6b7280',
    borderRadius: 1,
  },
  dragSlot: {
    position: 'absolute',
    backgroundColor: 'rgba(115, 117, 126, 0.42)',
    borderWidth: 0,
    zIndex: 1,
  } as any,
  /** Slot under the pointer (drop would apply here on release). */
  dragSlotTargeted: {
    backgroundColor: 'rgba(230, 232, 240, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  } as any,
  fab: {
    position: 'absolute',
    top: 10,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
    zIndex: 20,
  },
});

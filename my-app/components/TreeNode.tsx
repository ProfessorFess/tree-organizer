import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { runOnJS, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';
import { Node } from '../types/database';
import { TREE_NODE_SIZE, TREE_PLUS_ARM } from '../lib/tree';

const PLUS_ARM = TREE_PLUS_ARM;
const PLUS_BTN = 20;
const PLUS_ICON = 13;
const PLUS_EDGE_GAP = 4;
const HIT = TREE_NODE_SIZE + PLUS_ARM * 2;
const TAP_MOVE_THRESHOLD = 10;

export type TreeAddDirection = 'up' | 'down' | 'left' | 'right';

type TreeNodeProps = {
  node: Node;
  circleLeft: number;
  circleTop: number;
  displayLabel?: string;
  isProjectRoot: boolean;
  hoveredNodeId: string | null;
  onHoverChange: (id: string | null) => void;
  onNodePress: (node: Node) => void;
  onAddPress: (dir: TreeAddDirection, node: Node) => void;
  /** While a node is being dragged, hide (+) affordances to avoid gesture clashes. */
  treeDragActive?: boolean;
  /** Live offset for the node currently being dragged (circle center follows finger). */
  dragOffset?: { dx: number; dy: number } | null;
  /** True while a drag pointer is snapped for swap onto this node (not the dragged node). */
  swapDropTarget?: boolean;
  onTreeDragBegin?: (nodeId: string) => void;
  onTreeDragMove?: (nodeId: string, dx: number, dy: number, absX?: number, absY?: number) => void;
  onTreeDragComplete?: (nodeId: string, dx: number, dy: number, absX?: number, absY?: number) => void;
  onTreeDragClear?: () => void;
  statusColorFor: (status: string) => string;
};

export function TreeNode({
  node,
  circleLeft,
  circleTop,
  displayLabel,
  isProjectRoot,
  hoveredNodeId,
  onHoverChange,
  onNodePress,
  onAddPress,
  treeDragActive = false,
  dragOffset = null,
  swapDropTarget = false,
  onTreeDragBegin,
  onTreeDragMove,
  onTreeDragComplete,
  onTreeDragClear,
  statusColorFor,
}: TreeNodeProps) {
  const [pressed, setPressed] = useState(false);
  const hovered = hoveredNodeId === node.id || pressed;
  const label = displayLabel ?? node.label;
  const baseBorder = statusColorFor(node.status);
  const borderColor = baseBorder;

  const showUp = !isProjectRoot && !!node.parent_node_id;
  const showDown = true;
  const showLeft = !isProjectRoot && !!node.parent_node_id;
  const showRight = !isProjectRoot && !!node.parent_node_id;

  const cx = PLUS_ARM + TREE_NODE_SIZE / 2;
  const cy = PLUS_ARM + TREE_NODE_SIZE / 2;
  const half = PLUS_BTN / 2;
  const g = PLUS_EDGE_GAP;
  const circleTopInHit = PLUS_ARM;
  const circleBottomInHit = PLUS_ARM + TREE_NODE_SIZE;
  const circleLeftInHit = PLUS_ARM;
  const circleRightInHit = PLUS_ARM + TREE_NODE_SIZE;

  const circleGlow = Platform.select({
    web: {
      boxShadow: hovered
        ? `0 0 0 1px ${borderColor}33, 0 0 22px 6px ${borderColor}33`
        : `0 0 14px 3px ${borderColor}1F`,
    } as any,
    default: hovered
      ? {
          shadowColor: borderColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.28,
          shadowRadius: 12,
          elevation: 8,
        }
      : {
          shadowColor: borderColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 3,
        },
  });

  const left = circleLeft - PLUS_ARM;
  const top = circleTop - PLUS_ARM;

  const didMove = useSharedValue(false);
  const showPluses = !treeDragActive;
  const nodeId = node.id;
  /** Keeps tap-to-open stable without putting `node` in gesture deps (avoids remounting mid-drag). */
  const pressNodeRef = useRef(node);
  pressNodeRef.current = node;

  const finalizePan = useCallback(
    (moved: boolean) => {
      if (!moved) {
        onNodePress(pressNodeRef.current);
      }
      onTreeDragClear?.();
    },
    [onNodePress, onTreeDragClear]
  );

  const panGesture = useMemo(() => {
    if (
      isProjectRoot ||
      !onTreeDragBegin ||
      !onTreeDragMove ||
      !onTreeDragComplete ||
      !onTreeDragClear
    ) {
      return null;
    }
    return Gesture.Pan()
      .onBegin(() => {
        'worklet';
        didMove.value = false;
      })
      .onUpdate((e) => {
        'worklet';
        const dist = Math.hypot(e.translationX, e.translationY);
        if (dist > TAP_MOVE_THRESHOLD) {
          if (!didMove.value) {
            didMove.value = true;
            runOnJS(onTreeDragBegin)(nodeId);
          }
          runOnJS(onTreeDragMove)(
            nodeId,
            e.translationX,
            e.translationY,
            e.absoluteX,
            e.absoluteY
          );
        }
      })
      .onEnd((e) => {
        'worklet';
        if (didMove.value) {
          runOnJS(onTreeDragComplete)(
            nodeId,
            e.translationX,
            e.translationY,
            e.absoluteX,
            e.absoluteY
          );
        }
      })
      .onFinalize(() => {
        'worklet';
        const moved = didMove.value;
        runOnJS(finalizePan)(moved);
      });
  }, [
    isProjectRoot,
    nodeId,
    onTreeDragBegin,
    onTreeDragMove,
    onTreeDragComplete,
    onTreeDragClear,
    finalizePan,
    didMove,
  ]);

  /** (+) centers sit on the cross through the node center; edges sit `g` px past the circle rim. */
  const plusAt = (dir: 'up' | 'down' | 'left' | 'right') => {
    switch (dir) {
      case 'up':
        return { left: cx - half, top: circleTopInHit - g - PLUS_BTN };
      case 'down':
        return { left: cx - half, top: circleBottomInHit + g };
      case 'left':
        return { left: circleLeftInHit - g - PLUS_BTN, top: cy - half };
      case 'right':
        return { left: circleRightInHit + g, top: cy - half };
    }
  };

  const circleStyle = [
    styles.circle,
    {
      borderColor,
      top: PLUS_ARM,
      left: PLUS_ARM,
      opacity: dragOffset ? 0.4 : 1,
      ...(swapDropTarget ? { overflow: 'hidden' as const } : {}),
      ...(dragOffset
        ? {
            transform: [{ translateX: dragOffset.dx }, { translateY: dragOffset.dy }],
          }
        : null),
    },
    circleGlow,
  ];

  const circleInner = (
    <>
      {swapDropTarget && (
        <View style={[styles.swapTargetTint, { pointerEvents: 'none' }]} />
      )}
      <ThemedText style={[styles.label, styles.labelOnCircle]} numberOfLines={2}>
        {label}
      </ThemedText>
    </>
  );

  return (
    <View
      style={[
        styles.hitArea,
        { left, top, zIndex: dragOffset ? 60 : 2 },
      ]}
      onPointerEnter={() => onHoverChange(node.id)}
      onPointerLeave={() => onHoverChange(null)}
    >
      {isProjectRoot ? (
        <View style={circleStyle as any}>
          {circleInner}
        </View>
      ) : panGesture ? (
        <GestureDetector gesture={panGesture}>
          <Animated.View style={circleStyle as any}>{circleInner}</Animated.View>
        </GestureDetector>
      ) : (
        <Pressable
          style={circleStyle as any}
          onPress={() => onNodePress(node)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
        >
          {circleInner}
        </Pressable>
      )}

      {hovered && showPluses && showUp && (
        <Pressable
          style={[styles.plus, plusAt('up')]}
          hitSlop={8}
          onPress={(e) => {
            e?.stopPropagation?.();
            onAddPress('up', node);
          }}
        >
          {({ pressed }) => (
            <MaterialIcons
              name="add"
              size={PLUS_ICON}
              color={pressed ? '#ffffff' : '#e4e4e7'}
            />
          )}
        </Pressable>
      )}

      {hovered && showPluses && showDown && (
        <Pressable
          style={[styles.plus, plusAt('down')]}
          hitSlop={8}
          onPress={(e) => {
            e?.stopPropagation?.();
            onAddPress('down', node);
          }}
        >
          {({ pressed }) => (
            <MaterialIcons
              name="add"
              size={PLUS_ICON}
              color={pressed ? '#ffffff' : '#e4e4e7'}
            />
          )}
        </Pressable>
      )}

      {hovered && showPluses && showLeft && (
        <Pressable
          style={[styles.plus, plusAt('left')]}
          hitSlop={8}
          onPress={(e) => {
            e?.stopPropagation?.();
            onAddPress('left', node);
          }}
        >
          {({ pressed }) => (
            <MaterialIcons
              name="add"
              size={PLUS_ICON}
              color={pressed ? '#ffffff' : '#e4e4e7'}
            />
          )}
        </Pressable>
      )}

      {hovered && showPluses && showRight && (
        <Pressable
          style={[styles.plus, plusAt('right')]}
          hitSlop={8}
          onPress={(e) => {
            e?.stopPropagation?.();
            onAddPress('right', node);
          }}
        >
          {({ pressed }) => (
            <MaterialIcons
              name="add"
              size={PLUS_ICON}
              color={pressed ? '#ffffff' : '#e4e4e7'}
            />
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    zIndex: 2,
    overflow: 'visible',
  } as any,
  circle: {
    position: 'absolute',
    width: TREE_NODE_SIZE,
    height: TREE_NODE_SIZE,
    borderRadius: TREE_NODE_SIZE / 2,
    borderWidth: 2.5,
    backgroundColor: '#0c0c0e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  swapTargetTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TREE_NODE_SIZE / 2,
    backgroundColor: 'rgba(220, 222, 230, 0.32)',
    zIndex: 0,
  },
  label: {
    color: '#fafafa',
    fontSize: 10,
    lineHeight: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 0,
    paddingVertical: 0,
  } as any,
  labelOnCircle: {
    zIndex: 1,
  },
  plus: {
    position: 'absolute',
    width: PLUS_BTN,
    height: PLUS_BTN,
    borderRadius: PLUS_BTN / 2,
    backgroundColor: 'rgba(24, 24, 27, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6b7280',
    zIndex: 10,
  },
});

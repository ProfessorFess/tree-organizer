import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';
import { Node } from '../types/database';
import { flattenTreePreOrder, getRootNode } from '../lib/tree';

const MIN_SIDEBAR_WIDTH = 180;

type SidebarProps = {
  nodes: Node[];
  projectName: string;
  rootNodeId?: string;
  sidebarWidth: number;
  maxSidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  isOpen: boolean;
  onToggle: () => void;
};

export function Sidebar({
  nodes,
  projectName,
  rootNodeId,
  sidebarWidth,
  maxSidebarWidth,
  onSidebarWidthChange,
  isOpen,
  onToggle,
}: SidebarProps) {
  const orderedNodes = useMemo(() => {
    const root =
      (rootNodeId ? nodes.find((n) => n.id === rootNodeId) : null) ?? getRootNode(nodes);
    if (!root) return nodes;
    const ordered = flattenTreePreOrder(nodes, root);
    const seen = new Set(ordered.map((n) => n.id));
    const rest = nodes.filter((n) => !seen.has(n.id));
    return [...ordered, ...rest];
  }, [nodes, rootNodeId]);

  const applySidebarWidth = useCallback(
    (width: number) => {
      const effectiveMin = Math.min(MIN_SIDEBAR_WIDTH, maxSidebarWidth);
      const clamped = Math.max(effectiveMin, Math.min(maxSidebarWidth, width));
      onSidebarWidthChange(clamped);
    },
    [maxSidebarWidth, onSidebarWidthChange]
  );

  const wrapperRef = useRef<View | null>(null);
  const wrapperWindowXRef = useRef(0);
  const refreshWrapperWindowX = useCallback(() => {
    wrapperRef.current?.measureInWindow((x) => {
      wrapperWindowXRef.current = x;
    });
  }, []);

  const resizeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isOpen)
        .onBegin(() => {
          'worklet';
          runOnJS(refreshWrapperWindowX)();
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(applySidebarWidth)(e.absoluteX - wrapperWindowXRef.current);
        }),
    [applySidebarWidth, isOpen, refreshWrapperWindowX]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    width: isOpen ? sidebarWidth : withTiming(0, { duration: 250 }),
    overflow: 'hidden' as const,
  }));
  const toggleAnimatedStyle = useAnimatedStyle(() => ({
    left: isOpen ? sidebarWidth - 46 : withTiming(17, { duration: 250 }),
  }));

  return (
    <View ref={wrapperRef} style={styles.wrapper}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {orderedNodes.map((node) => (
            <View key={node.id} style={styles.nodeRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      node.status === 'stuck'
                        ? '#ef4444'
                        : node.status === 'completed'
                        ? '#3b82f6'
                        : '#10b981',
                  },
                ]}
              />
              <ThemedText style={styles.nodeLabel} numberOfLines={1}>
                {node.id === rootNodeId ? projectName : node.label}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
      {isOpen && (
        <GestureDetector gesture={resizeGesture}>
          <View style={styles.resizeHandle} />
        </GestureDetector>
      )}

      <Animated.View style={[styles.toggleButton, toggleAnimatedStyle]}>
        <Pressable style={styles.toggleButtonPressable} onPress={onToggle}>
          <MaterialIcons
            name={isOpen ? 'chevron-left' : 'chevron-right'}
            size={20}
            color="#a1a1aa"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'flex-start',
    overflow: 'visible',
    zIndex: 10,
  },
  container: {
    backgroundColor: '#111113',
    borderRightWidth: 1,
    borderRightColor: '#27272a',
    height: '100%',
  },
  scrollArea: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 12,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeLabel: {
    color: '#d4d4d8',
    fontSize: 14,
    flex: 1,
  },
  toggleButton: {
    position: 'absolute',
    top: 10,
    width: 34,
    height: 34,
    zIndex: 20,
  },
  toggleButtonPressable: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: -4,
    width: 10,
    zIndex: 15,
    cursor: 'col-resize',
  } as any,
});

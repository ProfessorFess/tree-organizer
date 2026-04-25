import { useMemo } from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from './themed-text';
import { Node } from '../types/database';
import { flattenTreePreOrder, getRootNode } from '../lib/tree';

const SIDEBAR_WIDTH = 220;

type SidebarProps = {
  nodes: Node[];
  projectName: string;
  rootNodeId?: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function Sidebar({ nodes, projectName, rootNodeId, isOpen, onToggle }: SidebarProps) {
  const orderedNodes = useMemo(() => {
    const root =
      (rootNodeId ? nodes.find((n) => n.id === rootNodeId) : null) ?? getRootNode(nodes);
    if (!root) return nodes;
    const ordered = flattenTreePreOrder(nodes, root);
    const seen = new Set(ordered.map((n) => n.id));
    const rest = nodes.filter((n) => !seen.has(n.id));
    return [...ordered, ...rest];
  }, [nodes, rootNodeId]);
  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(isOpen ? SIDEBAR_WIDTH : 0, { duration: 250 }),
    overflow: 'hidden' as const,
  }));

  return (
    <View style={styles.wrapper}>
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

      <Pressable style={styles.toggleButton} onPress={onToggle}>
        <MaterialIcons
          name={isOpen ? 'chevron-left' : 'chevron-right'}
          size={20}
          color="#a1a1aa"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginLeft: 4,
  },
});

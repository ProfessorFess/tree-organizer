import { StyleSheet, View, Pressable, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NodeCircle } from './NodeCircle';
import { Node } from '../types/database';

type WorkspaceProps = {
  nodes: Node[];
  onPlusPress: () => void;
};

function getNodePosition(index: number, total: number) {
  const cols = Math.ceil(Math.sqrt(total));
  const row = Math.floor(index / cols);
  const col = index % cols;
  const spacingX = 140;
  const spacingY = 130;
  const offsetX = 80;
  const offsetY = 60;
  return {
    left: offsetX + col * spacingX,
    top: offsetY + row * spacingY,
  };
}

const dotBackground = Platform.select({
  web: {
    backgroundImage:
      'radial-gradient(circle, #333 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  } as any,
  default: {},
});

export function Workspace({ nodes, onPlusPress }: WorkspaceProps) {
  return (
    <View style={[styles.container, dotBackground]}>
      {nodes.map((node, i) => {
        const pos = getNodePosition(i, nodes.length);
        return (
          <NodeCircle
            key={node.id}
            node={node}
            style={{ position: 'absolute', left: pos.left, top: pos.top }}
          />
        );
      })}

      <Pressable style={styles.fab} onPress={onPlusPress}>
        <MaterialIcons name="add" size={24} color="#fff" />
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
  fab: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
});

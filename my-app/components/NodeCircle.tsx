import { StyleSheet, Pressable } from 'react-native';
import { ThemedText } from './themed-text';
import { Node } from '../types/database';

const CIRCLE_SIZE = 80;

function getStatusColor(status: Node['status']): string {
  switch (status) {
    case 'stuck':
      return '#ef4444';
    case 'completed':
      return '#3b82f6';
    case 'active':
    default:
      return '#3b82f6';
  }
}

type NodeCircleProps = {
  node: Node;
  style?: object;
};

export function NodeCircle({ node, style }: NodeCircleProps) {
  const borderColor = getStatusColor(node.status);

  return (
    <Pressable style={[styles.circle, { borderColor }, style]}>
      <ThemedText style={styles.label} numberOfLines={2}>
        {node.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  label: {
    color: '#e4e4e7',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Node } from '../types/database';

export function NodeCard({ node, isSelected, onPress }: { node: Node, isSelected: boolean, onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[
        styles.card, 
        isSelected && styles.selectedCard,
        { borderLeftColor: node.status === 'stuck' ? '#ef4444' : '#10b981' }
      ]}>
        <View style={styles.content}>
          <ThemedText type="defaultSemiBold" style={styles.label}>{node.label}</ThemedText>
          <ThemedText style={styles.position}>{node.job_position || 'Member'}</ThemedText>
        </View>
        <View style={[styles.statusDot, { backgroundColor: node.status === 'stuck' ? '#ef4444' : '#10b981' }]} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46', // shadcn-style zinc border
    borderLeftWidth: 4,
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 10,
    backgroundColor: '#18181b', // shadcn zinc-950
  },
  selectedCard: {
    borderColor: '#3b82f6', // blue-500 for selection
    backgroundColor: '#27272a',
  },
  content: { flex: 1 },
  label: { fontSize: 14 },
  position: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
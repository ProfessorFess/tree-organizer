import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { nodeService } from '../services/nodeService';
import { Node } from '../types/database';
import { NodeCard } from '../components/NodeCard';

const PROJECT_ID = 'dde69e85-3148-4a77-9ade-49036075a699'; // Your UUID

export default function HomeScreen() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTree() {
      try {
        const data = await nodeService.getNodesByProject(PROJECT_ID);
        setNodes(data);
        if (data.length > 0) setSelectedNode(data[0]); // Default select root
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    }
    loadTree();
  }, []);

  if (loading) return <ThemedView style={styles.center}><ActivityIndicator /></ThemedView>;

  return (
    <ThemedView style={styles.container}>
      {/* 1. Main Canvas Area */}
      <ScrollView horizontal contentContainerStyle={styles.canvas}>
        <ScrollView contentContainerStyle={styles.treeContainer}>
          {nodes.map(node => (
            <NodeCard 
              key={node.id} 
              node={node} 
              isSelected={selectedNode?.id === node.id}
              onPress={() => setSelectedNode(node)}
            />
          ))}
        </ScrollView>
      </ScrollView>

      {/* 2. Side Task Panel (Visible when a node is clicked) */}
      {selectedNode && (
        <ThemedView style={styles.sidePanel}>
          <ThemedText type="subtitle" style={styles.panelTitle}>{selectedNode.label}</ThemedText>
          <ThemedText style={styles.panelSubtitle}>{selectedNode.job_position}</ThemedText>
          
          <View style={styles.divider} />
          
          <ThemedText type="defaultSemiBold">Tasks</ThemedText>
          <ThemedText style={styles.emptyTasks}>No tasks assigned yet.</ThemedText>
          {/* We'll add the task list component here next */}
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' }, // Row layout for Sidebar
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  canvas: { backgroundColor: '#09090b' }, // Darker background
  treeContainer: { padding: 40, alignItems: 'center' },
  sidePanel: {
    width: 300,
    borderLeftWidth: 1,
    borderColor: '#27272a',
    padding: 20,
    backgroundColor: '#18181b',
  },
  panelTitle: { marginBottom: 4 },
  panelSubtitle: { opacity: 0.6, fontSize: 14, marginBottom: 20 },
  divider: { height: 1, backgroundColor: '#27272a', marginBottom: 20 },
  emptyTasks: { marginTop: 10, opacity: 0.4, fontSize: 13 }
});
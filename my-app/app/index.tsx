import React, { useEffect, useState } from 'react';
import { StyleSheet, FlatList, ActivityIndicator, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { nodeService } from '../services/nodeService';
import { Node } from '../types/database';

// Your actual Supabase Project ID
const TEST_PROJECT_ID = 'dde69e85-3148-4a77-9ade-49036075a699';

export default function HomeScreen() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTestData() {
      try {
        setLoading(true);
        // This calls your backend service
        const data = await nodeService.getNodesByProject(TEST_PROJECT_ID);
        setNodes(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch nodes');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    // Run the fetch immediately
    fetchTestData();
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>Manager-App: Project Nodes</ThemedText>
      
      {error && (
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={styles.error}>Error: {error}</ThemedText>
        </ThemedView>
      )}

      <FlatList
        data={nodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.nodeItem}>
            <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
            <ThemedText>Position: {item.job_position || 'N/A'}</ThemedText>
            <ThemedText>Type: {item.node_type} | Status: {item.status}</ThemedText>
          </View>
        )}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            No nodes found. Make sure the nodes table has rows with project_id: {TEST_PROJECT_ID}
          </ThemedText>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  nodeItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 10,
  },
  errorContainer: {
    backgroundColor: '#ffdde0',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  error: {
    color: '#d32f2f',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    opacity: 0.6,
  },
});
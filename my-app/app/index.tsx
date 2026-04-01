import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { Workspace } from '../components/Workspace';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { EditNodeModal } from '../components/EditNodeModal';
import { nodeService } from '../services/nodeService';
import { Node } from '../types/database';

const PROJECT_ID = 'dde69e85-3148-4a77-9ade-49036075a699';

export default function HomeScreen() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  useEffect(() => {
    async function loadTree() {
      try {
        const data = await nodeService.getNodesByProject(PROJECT_ID);
        setNodes(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadTree();
  }, []);

  const handleNodeCreated = (newNode: Node) => {
    setNodes((prev) => [...prev, newNode]);
    setShowCreateModal(false);
  };

  const handleNodeUpdated = (updatedNode: Node) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setEditingNode(null);
  };

  const handleNodeDeleted = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEditingNode(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar />

      <View style={styles.body}>
        <Sidebar
          nodes={nodes}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />

        <Workspace
          nodes={nodes}
          onPlusPress={() => setShowCreateModal(true)}
          onNodePress={(node) => setEditingNode(node)}
        />
      </View>

      <CreateNodeModal
        visible={showCreateModal}
        projectId={PROJECT_ID}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleNodeCreated}
      />

      <EditNodeModal
        node={editingNode}
        onClose={() => setEditingNode(null)}
        onUpdated={handleNodeUpdated}
        onDeleted={handleNodeDeleted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090b',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
});

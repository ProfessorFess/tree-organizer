import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { Workspace } from '../components/Workspace';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { EditNodeModal } from '../components/EditNodeModal';
import { nodeService } from '../services/nodeService';
import { projectService } from '../services/projectService';
import { Node } from '../types/database';
import type { CreateIntent } from '../types/createIntent';
import { getRootNode } from '../lib/tree';

const PROJECT_ID = 'dde69e85-3148-4a77-9ade-49036075a699';
const bodyDotBackground = Platform.select({
  web: {
    backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  } as any,
  default: {},
});

export default function HomeScreen() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [projectName, setProjectName] = useState('Project');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [createIntent, setCreateIntent] = useState<CreateIntent | null>(null);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  const rootNode = useMemo(() => getRootNode(nodes), [nodes]);

  useEffect(() => {
    async function loadTree() {
      try {
        const [nodesData, project] = await Promise.all([
          nodeService.getNodesByProject(PROJECT_ID),
          projectService.getProject(PROJECT_ID).catch(() => null),
        ]);
        setNodes(nodesData);
        if (project?.name) setProjectName(project.name);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadTree();
  }, []);

  const handleProjectNameCommit = useCallback(
    async (name: string) => {
      const updated = await projectService.updateProjectName(PROJECT_ID, name);
      setProjectName(updated.name);
      if (rootNode) {
        try {
          const sync = await nodeService.updateNode(rootNode.id, { label: name });
          setNodes((prev) => prev.map((n) => (n.id === rootNode.id ? sync : n)));
        } catch (e) {
          console.error(e);
        }
      }
    },
    [rootNode]
  );

  const handleCreateSubmit = useCallback(
    async (intent: CreateIntent, data: { label: string; status: Node['status'] }) => {
      if (intent.kind === 'root') {
        const newNode = await nodeService.createNode({
          project_id: PROJECT_ID,
          label: data.label,
          node_type: 'ROOT',
          status: data.status,
          parent_node_id: null,
        });
        setNodes((prev) => [...prev, newNode]);
        return;
      }
      if (intent.kind === 'child') {
        const newNode = await nodeService.createNode({
          project_id: PROJECT_ID,
          parent_node_id: intent.parentId,
          label: data.label,
          node_type: 'PERSON',
          status: data.status,
        });
        setNodes((prev) => [...prev, newNode]);
        return;
      }
      if (intent.kind === 'sibling') {
        const newNode = await nodeService.createNode({
          project_id: PROJECT_ID,
          parent_node_id: intent.parentId,
          label: data.label,
          node_type: 'PERSON',
          status: data.status,
        });
        setNodes((prev) => [...prev, newNode]);
        return;
      }
      if (intent.kind === 'insertAbove') {
        await nodeService.insertNodeAbove(
          PROJECT_ID,
          intent.anchorId,
          data.label,
          data.status
        );
        const fresh = await nodeService.getNodesByProject(PROJECT_ID);
        setNodes(fresh);
      }
    },
    []
  );

  const handleNodeUpdated = (updatedNode: Node) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setEditingNode(null);
  };

  const handleNodeDeleted = async () => {
    try {
      const fresh = await nodeService.getNodesByProject(PROJECT_ID);
      setNodes(fresh);
    } catch (e) {
      console.error(e);
    } finally {
      setEditingNode(null);
    }
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
      <TopBar
        projectName={projectName}
        onProjectNameCommit={handleProjectNameCommit}
      />

      <View style={[styles.body, bodyDotBackground]}>
        <Sidebar
          nodes={nodes}
          projectName={projectName}
          rootNodeId={rootNode?.id}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />

        <Workspace
          nodes={nodes}
          projectName={projectName}
          onNodePress={(node) => setEditingNode(node)}
          onRequestCreate={(intent) => setCreateIntent(intent)}
          onTreeReload={async () => {
            const fresh = await nodeService.getNodesByProject(PROJECT_ID);
            setNodes(fresh);
          }}
        />
      </View>

      <CreateNodeModal
        intent={createIntent}
        defaultRootLabel={projectName}
        onClose={() => setCreateIntent(null)}
        onSubmit={handleCreateSubmit}
      />

      <EditNodeModal
        node={editingNode}
        projectName={projectName}
        hubNodeId={rootNode?.id ?? null}
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

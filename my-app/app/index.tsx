import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { Workspace } from '../components/Workspace';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { EditNodeModal } from '../components/EditNodeModal';
import { StatusManagerModal } from '../components/StatusManagerModal';
import { nodeService } from '../services/nodeService';
import { projectService } from '../services/projectService';
import { statusService } from '../services/statusService';
import { Node } from '../types/database';
import type { CreateIntent } from '../types/createIntent';
import type { StatusDefinition } from '../types/status';
import { getRootNode } from '../lib/tree';

const PROJECT_ID = 'dde69e85-3148-4a77-9ade-49036075a699';
const DEFAULT_STATUS_KEY = 'active';
const BASE_STATUS_KEYS = new Set(['active', 'stuck', 'completed']);
const DEFAULT_STATUSES: StatusDefinition[] = [
  { key: DEFAULT_STATUS_KEY, label: 'Default', color: '#3b82f6' },
];
const bodyDotBackground = Platform.select({
  web: {
    backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  } as any,
  default: {},
});

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const maxSidebarWidth = Math.max(120, Math.floor(windowWidth / 3));
  const [nodes, setNodes] = useState<Node[]>([]);
  const [projectName, setProjectName] = useState('Project');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [statuses, setStatuses] = useState<StatusDefinition[]>(DEFAULT_STATUSES);
  const [nodeStatusOverrides, setNodeStatusOverrides] = useState<Record<string, string>>({});
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [createIntent, setCreateIntent] = useState<CreateIntent | null>(null);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        status: nodeStatusOverrides[n.id] ?? n.status,
      })),
    [nodes, nodeStatusOverrides]
  );
  const rootDisplayNode = useMemo(() => getRootNode(displayNodes), [displayNodes]);
  const statusColorFor = useCallback(
    (status: string) =>
      statuses.find((s) => s.key === status)?.color ?? DEFAULT_STATUSES[0].color,
    [statuses]
  );

  useEffect(() => {
    setSidebarWidth((prev) => Math.min(prev, maxSidebarWidth));
  }, [maxSidebarWidth]);

  useEffect(() => {
    const seen = new Set(statuses.map((s) => s.key));
    const missing = Array.from(new Set(nodes.map((n) => n.status))).filter((s) => !seen.has(s));
    if (missing.length === 0) return;
    setStatuses((prev) => [
      ...prev,
      ...missing.map((m, i) => ({
        key: m,
        label: m,
        color: ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b'][i % 4],
      })),
    ]);
  }, [nodes, statuses]);

  useEffect(() => {
    async function loadTree() {
      try {
        const [nodesData, project, dbStatuses, dbOverrides] = await Promise.all([
          nodeService.getNodesByProject(PROJECT_ID),
          projectService.getProject(PROJECT_ID).catch(() => null),
          statusService.getStatusesByProject(PROJECT_ID).catch(() => []),
          statusService.getNodeStatusOverrides(PROJECT_ID).catch(() => []),
        ]);
        setNodes(nodesData);
        if (dbStatuses.length > 0) {
          setStatuses(dbStatuses);
        } else {
          void Promise.all(
            DEFAULT_STATUSES.map((s) => statusService.upsertStatus(PROJECT_ID, s).catch(() => null))
          );
        }
        setNodeStatusOverrides(
          Object.fromEntries(dbOverrides.map((o) => [o.node_id, o.status_key]))
        );
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
      if (rootDisplayNode) {
        try {
          const sync = await nodeService.updateNode(rootDisplayNode.id, { label: name });
          setNodes((prev) => prev.map((n) => (n.id === rootDisplayNode.id ? sync : n)));
        } catch (e) {
          console.error(e);
        }
      }
    },
    [rootDisplayNode]
  );

  const toPersistedStatus = useCallback(
    (status: string): Node['status'] =>
      (BASE_STATUS_KEYS.has(status) ? status : DEFAULT_STATUS_KEY) as Node['status'],
    []
  );

  const handleCreateSubmit = useCallback(
    async (intent: CreateIntent, data: { label: string; status: Node['status'] }) => {
      const persistedStatus = toPersistedStatus(data.status);
      if (intent.kind === 'root') {
        const newNode = await nodeService.createNode({
          project_id: PROJECT_ID,
          label: data.label,
          node_type: 'ROOT',
          status: persistedStatus,
          parent_node_id: null,
        });
        setNodes((prev) => [...prev, newNode]);
        if (!BASE_STATUS_KEYS.has(data.status)) {
          setNodeStatusOverrides((prev) => ({ ...prev, [newNode.id]: data.status }));
          await statusService.upsertNodeStatusOverride(PROJECT_ID, newNode.id, data.status);
        }
        return;
      }
      if (intent.kind === 'child') {
        const newNode = await nodeService.createNode({
          project_id: PROJECT_ID,
          parent_node_id: intent.parentId,
          label: data.label,
          node_type: 'PERSON',
          status: persistedStatus,
        });
        setNodes((prev) => [...prev, newNode]);
        if (!BASE_STATUS_KEYS.has(data.status)) {
          setNodeStatusOverrides((prev) => ({ ...prev, [newNode.id]: data.status }));
          await statusService.upsertNodeStatusOverride(PROJECT_ID, newNode.id, data.status);
        }
        return;
      }
      if (intent.kind === 'sibling') {
        const newNode = await nodeService.createNode({
          project_id: PROJECT_ID,
          parent_node_id: intent.parentId,
          label: data.label,
          node_type: 'PERSON',
          status: persistedStatus,
        });
        setNodes((prev) => [...prev, newNode]);
        if (!BASE_STATUS_KEYS.has(data.status)) {
          setNodeStatusOverrides((prev) => ({ ...prev, [newNode.id]: data.status }));
          await statusService.upsertNodeStatusOverride(PROJECT_ID, newNode.id, data.status);
        }
        return;
      }
      if (intent.kind === 'insertAbove') {
        const { newNode } = await nodeService.insertNodeAbove(
          PROJECT_ID,
          intent.anchorId,
          data.label,
          persistedStatus
        );
        if (!BASE_STATUS_KEYS.has(data.status)) {
          setNodeStatusOverrides((prev) => ({ ...prev, [newNode.id]: data.status }));
          await statusService.upsertNodeStatusOverride(PROJECT_ID, newNode.id, data.status);
        }
        const fresh = await nodeService.getNodesByProject(PROJECT_ID);
        setNodes(fresh);
      }
    },
    [toPersistedStatus]
  );

  const handleNodeUpdated = (updatedNode: Node) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setNodeStatusOverrides((prev) => {
      if (BASE_STATUS_KEYS.has(updatedNode.status)) {
        if (!(updatedNode.id in prev)) return prev;
        const next = { ...prev };
        delete next[updatedNode.id];
        void statusService.deleteNodeStatusOverride(PROJECT_ID, updatedNode.id).catch((e) =>
          console.error('Failed to delete node status override', e)
        );
        return next;
      }
      void statusService
        .upsertNodeStatusOverride(PROJECT_ID, updatedNode.id, updatedNode.status)
        .catch((e) => console.error('Failed to save node status override', e));
      return { ...prev, [updatedNode.id]: updatedNode.status };
    });
    setEditingNode(null);
  };

  const handleNodeDeleted = async () => {
    try {
      const fresh = await nodeService.getNodesByProject(PROJECT_ID);
      setNodes(fresh);
      setNodeStatusOverrides((prev) => {
        const existing = new Set(fresh.map((n) => n.id));
        let changed = false;
        const next: Record<string, string> = {};
        Object.entries(prev).forEach(([id, statusKey]) => {
          if (existing.has(id)) next[id] = statusKey;
          else changed = true;
        });
        return changed ? next : prev;
      });
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
          nodes={displayNodes}
          projectName={projectName}
          rootNodeId={rootDisplayNode?.id}
          statusColorFor={statusColorFor}
          sidebarWidth={sidebarWidth}
          maxSidebarWidth={maxSidebarWidth}
          onSidebarWidthChange={setSidebarWidth}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
        />

        <Workspace
          nodes={displayNodes}
          projectName={projectName}
          statuses={statuses}
          statusColorFor={statusColorFor}
          onNodePress={(node) => setEditingNode(node)}
          onRequestCreate={(intent) => setCreateIntent(intent)}
          onManageStatuses={() => setStatusModalOpen(true)}
          onTreeReload={async () => {
            const fresh = await nodeService.getNodesByProject(PROJECT_ID);
            setNodes(fresh);
          }}
        />
      </View>

      <CreateNodeModal
        intent={createIntent}
        defaultRootLabel={projectName}
        statuses={statuses}
        onClose={() => setCreateIntent(null)}
        onSubmit={handleCreateSubmit}
      />

      <EditNodeModal
        node={editingNode}
        projectName={projectName}
        hubNodeId={rootDisplayNode?.id ?? null}
        statuses={statuses}
        onClose={() => setEditingNode(null)}
        onUpdated={handleNodeUpdated}
        onDeleted={handleNodeDeleted}
      />
      <StatusManagerModal
        visible={statusModalOpen}
        statuses={statuses}
        onClose={() => setStatusModalOpen(false)}
        onCreate={(status) => {
          setStatuses((prev) => [...prev, status]);
          void statusService
            .upsertStatus(PROJECT_ID, status)
            .catch((e) => console.error('Failed to create status', e));
        }}
        onUpdate={(status) => {
          setStatuses((prev) => prev.map((s) => (s.key === status.key ? status : s)));
          void statusService
            .upsertStatus(PROJECT_ID, status)
            .catch((e) => console.error('Failed to update status', e));
        }}
        onDelete={(statusKey) => {
          const affectedIds = displayNodes.filter((n) => n.status === statusKey).map((n) => n.id);
          setStatuses((prev) => prev.filter((s) => s.key !== statusKey));
          setNodes((prev) =>
            prev.map((n) =>
              n.status === statusKey ? { ...n, status: DEFAULT_STATUSES[0].key } : n
            )
          );
          setNodeStatusOverrides((prev) => {
            const next = { ...prev };
            affectedIds.forEach((id) => delete next[id]);
            return next;
          });
          void statusService
            .deleteStatus(PROJECT_ID, statusKey)
            .catch((e) => console.error('Failed to delete status', e));
          void statusService
            .deleteOverridesByStatus(PROJECT_ID, statusKey)
            .catch((e) => console.error('Failed to delete status overrides', e));
          void Promise.all(
            affectedIds.map((id) =>
              nodeService
                .updateNodeStatus(id, DEFAULT_STATUS_KEY)
                .catch((err) => console.error('Failed to reassign status', err))
            )
          );
        }}
        undeletableStatusKeys={[DEFAULT_STATUS_KEY]}
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

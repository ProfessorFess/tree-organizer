import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { TopBar } from '../components/TopBar';
import { Sidebar } from '../components/Sidebar';
import { Workspace } from '../components/Workspace';
import { CreateNodeModal } from '../components/CreateNodeModal';
import { EditNodeModal } from '../components/EditNodeModal';
import { StatusManagerModal } from '../components/StatusManagerModal';
import { nodeService } from '../services/nodeService';
import { projectService } from '../services/projectService';
import { statusService } from '../services/statusService';
import { Node, Project } from '../types/database';
import type { CreateIntent } from '../types/createIntent';
import type { StatusDefinition } from '../types/status';
import { getRootNode } from '../lib/tree';

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
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

  const loadProjectData = useCallback(async (projectId: string) => {
    const [nodesData, project, dbStatuses, dbOverrides] = await Promise.all([
      nodeService.getNodesByProject(projectId),
      projectService.getProject(projectId).catch(() => null),
      statusService.getStatusesByProject(projectId).catch(() => []),
      statusService.getNodeStatusOverrides(projectId).catch(() => []),
    ]);
    setNodes(nodesData);
    if (dbStatuses.length > 0) {
      setStatuses(dbStatuses);
    } else {
      setStatuses(DEFAULT_STATUSES);
      void Promise.all(
        DEFAULT_STATUSES.map((s) => statusService.upsertStatus(projectId, s).catch(() => null))
      );
    }
    setNodeStatusOverrides(Object.fromEntries(dbOverrides.map((o) => [o.node_id, o.status_key])));
    if (project?.name) setProjectName(project.name);
  }, []);

  useEffect(() => {
    async function loadInitial() {
      try {
        const dbProjects = await projectService.getProjects();
        setProjects(dbProjects);
        if (dbProjects.length === 0) {
          setActiveProjectId(null);
          setNodes([]);
          setProjectName('Project');
          setStatuses(DEFAULT_STATUSES);
          setNodeStatusOverrides({});
          return;
        }
        const firstProjectId = dbProjects[0].id;
        setActiveProjectId(firstProjectId);
        await loadProjectData(firstProjectId);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void loadInitial();
  }, [loadProjectData]);

  const handleProjectNameCommit = useCallback(
    async (name: string) => {
      if (!activeProjectId) return;
      const updated = await projectService.updateProjectName(activeProjectId, name);
      setProjectName(updated.name);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (rootDisplayNode) {
        try {
          const sync = await nodeService.updateNode(rootDisplayNode.id, { label: name });
          setNodes((prev) => prev.map((n) => (n.id === rootDisplayNode.id ? sync : n)));
        } catch (e) {
          console.error(e);
        }
      }
    },
    [activeProjectId, rootDisplayNode]
  );

  const handleCreateWorkspace = useCallback(async (name: string) => {
    const created = await projectService.createProject(name);
    setProjects((prev) => [...prev, created]);
    await nodeService.createNode({
      project_id: created.id,
      label: created.name,
      node_type: 'ROOT',
      status: DEFAULT_STATUS_KEY,
      parent_node_id: null,
    });
    await statusService.upsertStatus(created.id, DEFAULT_STATUSES[0]);
    setActiveProjectId(created.id);
    await loadProjectData(created.id);
  }, [loadProjectData]);

  const handleProjectSelect = useCallback(
    async (projectId: string) => {
      if (projectId === activeProjectId) return;
      setActiveProjectId(projectId);
      try {
        await loadProjectData(projectId);
      } catch (e) {
        console.error(e);
      }
    },
    [activeProjectId, loadProjectData]
  );

  const handleProjectDelete = useCallback(
    async (project: Project) => {
      if (projects.length <= 1) {
        Alert.alert('Cannot delete', 'At least one project must remain.');
        return;
      }
      try {
        await projectService.deleteProject(project.id);
        const nextProjects = projects.filter((p) => p.id !== project.id);
        setProjects(nextProjects);
        if (activeProjectId === project.id) {
          const fallbackId = nextProjects[0]?.id ?? null;
          setActiveProjectId(fallbackId);
          if (fallbackId) {
            await loadProjectData(fallbackId);
          } else {
            setNodes([]);
            setProjectName('Project');
            setStatuses(DEFAULT_STATUSES);
            setNodeStatusOverrides({});
          }
        }
      } catch (e) {
        console.error(e);
      }
    },
    [activeProjectId, loadProjectData, projects]
  );

  const handleProjectRename = useCallback(
    async (projectId: string, name: string) => {
      const updated = await projectService.updateProjectName(projectId, name);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (activeProjectId === updated.id) {
        setProjectName(updated.name);
        if (rootDisplayNode) {
          try {
            const sync = await nodeService.updateNode(rootDisplayNode.id, { label: updated.name });
            setNodes((prev) => prev.map((n) => (n.id === rootDisplayNode.id ? sync : n)));
          } catch (e) {
            console.error(e);
          }
        }
      }
    },
    [activeProjectId, rootDisplayNode]
  );

  const handleProjectReorder = useCallback((projectIds: string[]) => {
    setProjects((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      const reordered = projectIds
        .map((id) => byId.get(id))
        .filter((p): p is Project => !!p);
      if (reordered.length !== prev.length) return prev;
      return reordered;
    });
  }, []);

  const toPersistedStatus = useCallback(
    (status: string): Node['status'] =>
      (BASE_STATUS_KEYS.has(status) ? status : DEFAULT_STATUS_KEY) as Node['status'],
    []
  );

  const handleCreateSubmit = useCallback(
    async (intent: CreateIntent, data: { label: string; status: Node['status'] }) => {
      const persistedStatus = toPersistedStatus(data.status);
      if (intent.kind === 'root') {
        if (!activeProjectId) return;
        const newNode = await nodeService.createNode({
          project_id: activeProjectId,
          label: data.label,
          node_type: 'ROOT',
          status: persistedStatus,
          parent_node_id: null,
        });
        setNodes((prev) => [...prev, newNode]);
        if (!BASE_STATUS_KEYS.has(data.status)) {
          setNodeStatusOverrides((prev) => ({ ...prev, [newNode.id]: data.status }));
          await statusService.upsertNodeStatusOverride(activeProjectId, newNode.id, data.status);
        }
        return;
      }
      if (intent.kind === 'child') {
        if (!activeProjectId) return;
        const newNode = await nodeService.createNode({
          project_id: activeProjectId,
          parent_node_id: intent.parentId,
          label: data.label,
          node_type: 'PERSON',
          status: persistedStatus,
        });
        setNodes((prev) => [...prev, newNode]);
        if (!BASE_STATUS_KEYS.has(data.status)) {
          setNodeStatusOverrides((prev) => ({ ...prev, [newNode.id]: data.status }));
          await statusService.upsertNodeStatusOverride(activeProjectId, newNode.id, data.status);
        }
        return;
      }
      if (intent.kind === 'sibling') {
        if (!activeProjectId) return;
        const newNode = await nodeService.createNode({
          project_id: activeProjectId,
          parent_node_id: intent.parentId,
          label: data.label,
          node_type: 'PERSON',
          status: persistedStatus,
        });
        setNodes((prev) => [...prev, newNode]);
        if (!BASE_STATUS_KEYS.has(data.status)) {
          setNodeStatusOverrides((prev) => ({ ...prev, [newNode.id]: data.status }));
          await statusService.upsertNodeStatusOverride(activeProjectId, newNode.id, data.status);
        }
        return;
      }
      if (intent.kind === 'insertAbove') {
        if (!activeProjectId) return;
        const { newNode } = await nodeService.insertNodeAbove(
          activeProjectId,
          intent.anchorId,
          data.label,
          persistedStatus
        );
        if (!BASE_STATUS_KEYS.has(data.status)) {
          setNodeStatusOverrides((prev) => ({ ...prev, [newNode.id]: data.status }));
          await statusService.upsertNodeStatusOverride(activeProjectId, newNode.id, data.status);
        }
        const fresh = await nodeService.getNodesByProject(activeProjectId);
        setNodes(fresh);
      }
    },
    [activeProjectId, toPersistedStatus]
  );

  const handleNodeUpdated = (updatedNode: Node) => {
    if (!activeProjectId) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setNodeStatusOverrides((prev) => {
      if (BASE_STATUS_KEYS.has(updatedNode.status)) {
        if (!(updatedNode.id in prev)) return prev;
        const next = { ...prev };
        delete next[updatedNode.id];
        void statusService.deleteNodeStatusOverride(activeProjectId, updatedNode.id).catch((e) =>
          console.error('Failed to delete node status override', e)
        );
        return next;
      }
      void statusService
        .upsertNodeStatusOverride(activeProjectId, updatedNode.id, updatedNode.status)
        .catch((e) => console.error('Failed to save node status override', e));
      return { ...prev, [updatedNode.id]: updatedNode.status };
    });
    setEditingNode(null);
  };

  const handleNodeDeleted = async () => {
    if (!activeProjectId) return;
    try {
      const fresh = await nodeService.getNodesByProject(activeProjectId);
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
        onCreateWorkspace={handleCreateWorkspace}
      />

      <View style={[styles.body, bodyDotBackground]}>
        <Sidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onProjectSelect={(projectId) => void handleProjectSelect(projectId)}
          onProjectDelete={handleProjectDelete}
          onProjectRename={handleProjectRename}
          onProjectReorder={handleProjectReorder}
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
            if (!activeProjectId) return;
            const fresh = await nodeService.getNodesByProject(activeProjectId);
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
          if (!activeProjectId) return;
          void statusService
            .upsertStatus(activeProjectId, status)
            .catch((e) => console.error('Failed to create status', e));
        }}
        onUpdate={(status) => {
          setStatuses((prev) => prev.map((s) => (s.key === status.key ? status : s)));
          if (!activeProjectId) return;
          void statusService
            .upsertStatus(activeProjectId, status)
            .catch((e) => console.error('Failed to update status', e));
        }}
        onDelete={(statusKey) => {
          if (!activeProjectId) return;
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
            .deleteStatus(activeProjectId, statusKey)
            .catch((e) => console.error('Failed to delete status', e));
          void statusService
            .deleteOverridesByStatus(activeProjectId, statusKey)
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

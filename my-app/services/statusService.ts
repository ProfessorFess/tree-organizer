import { supabase } from '../lib/supabase';
import type { NodeStatusOverride, StatusDefinition } from '../types/status';

export const statusService = {
  async getStatusesByProject(projectId: string): Promise<StatusDefinition[]> {
    const { data, error } = await supabase
      .from('project_statuses')
      .select('project_id, key, label, color')
      .eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []) as StatusDefinition[];
  },

  async upsertStatus(projectId: string, status: StatusDefinition): Promise<void> {
    const { error } = await supabase
      .from('project_statuses')
      .upsert(
        {
          project_id: projectId,
          key: status.key,
          label: status.label,
          color: status.color,
        },
        { onConflict: 'project_id,key' }
      );
    if (error) throw error;
  },

  async deleteStatus(projectId: string, statusKey: string): Promise<void> {
    const { error } = await supabase
      .from('project_statuses')
      .delete()
      .eq('project_id', projectId)
      .eq('key', statusKey);
    if (error) throw error;
  },

  async getNodeStatusOverrides(projectId: string): Promise<NodeStatusOverride[]> {
    const { data, error } = await supabase
      .from('node_status_overrides')
      .select('project_id, node_id, status_key')
      .eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []) as NodeStatusOverride[];
  },

  async upsertNodeStatusOverride(
    projectId: string,
    nodeId: string,
    statusKey: string
  ): Promise<void> {
    const { error } = await supabase
      .from('node_status_overrides')
      .upsert(
        {
          project_id: projectId,
          node_id: nodeId,
          status_key: statusKey,
        },
        { onConflict: 'project_id,node_id' }
      );
    if (error) throw error;
  },

  async deleteNodeStatusOverride(projectId: string, nodeId: string): Promise<void> {
    const { error } = await supabase
      .from('node_status_overrides')
      .delete()
      .eq('project_id', projectId)
      .eq('node_id', nodeId);
    if (error) throw error;
  },

  async deleteOverridesByStatus(projectId: string, statusKey: string): Promise<void> {
    const { error } = await supabase
      .from('node_status_overrides')
      .delete()
      .eq('project_id', projectId)
      .eq('status_key', statusKey);
    if (error) throw error;
  },
};


import { supabase } from '../lib/supabase';
import { Node } from '../types/database';

export const nodeService = {
  // Fetch all nodes for a specific project tree
  async getNodesByProject(projectId: string) {
    const { data, error } = await supabase
      .from('nodes')
      .select('*')
      .eq('project_id', projectId);
    
    if (error) throw error;
    return data as Node[];
  },

  // Create a new node (e.g., adding a team member)
  async createNode(newNode: Partial<Node>) {
    const { data, error } = await supabase
      .from('nodes')
      .insert(newNode)
      .select()
      .single();

    if (error) throw error;
    return data as Node;
  },

  // Update a status (e.g., changing someone to "stuck")
  async updateNodeStatus(nodeId: string, status: Node['status']) {
    const { error } = await supabase
      .from('nodes')
      .update({ status })
      .eq('id', nodeId);

    if (error) throw error;
  },

  // Update any editable fields on a node
  async updateNode(nodeId: string, updates: Partial<Omit<Node, 'id' | 'project_id'>>) {
    const { data, error } = await supabase
      .from('nodes')
      .update(updates)
      .eq('id', nodeId)
      .select()
      .single();

    if (error) throw error;
    return data as Node;
  },

  // Permanently delete a node
  async deleteNode(nodeId: string) {
    const { error } = await supabase
      .from('nodes')
      .delete()
      .eq('id', nodeId);

    if (error) throw error;
  },
};
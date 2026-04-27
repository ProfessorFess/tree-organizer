import { supabase } from '../lib/supabase';
import { Project } from '../types/database';

export const projectService = {
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Project[];
  },

  async getProject(projectId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (error) throw error;
    return data as Project;
  },

  async updateProjectName(projectId: string, name: string) {
    const { data, error } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', projectId)
      .select('id, name')
      .single();

    if (error) throw error;
    return data as Project;
  },

  async createProject(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Project name is required');
    }
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: trimmed })
      .select('id, name')
      .single();

    if (error) throw error;
    return data as Project;
  },

  async deleteProject(projectId: string) {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
  },
};

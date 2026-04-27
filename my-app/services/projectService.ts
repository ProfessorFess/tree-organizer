import { supabase } from '../lib/supabase';
import { Project } from '../types/database';

export const projectService = {
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
};

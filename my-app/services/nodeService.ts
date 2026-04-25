import { supabase } from '../lib/supabase';
import { compareSiblingOrder } from '../lib/tree';
import { Node } from '../types/database';
import type { SiblingDropPlacement } from '../types/siblingDrop';

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

  /**
   * Deletes only this node. Direct children are reparented to the deleted node's parent
   * (one level up), preserving the subtree below them.
   */
  async deleteNode(nodeId: string) {
    const { data: target, error: e0 } = await supabase
      .from('nodes')
      .select('id, parent_node_id')
      .eq('id', nodeId)
      .single();

    if (e0) throw e0;

    const adoptiveParentId = target.parent_node_id;

    const { error: e1 } = await supabase
      .from('nodes')
      .update({ parent_node_id: adoptiveParentId })
      .eq('parent_node_id', nodeId);

    if (e1) throw e1;

    const { error: e2 } = await supabase.from('nodes').delete().eq('id', nodeId);
    if (e2) throw e2;
  },

  /** Insert a new node between `anchor` and its parent; anchor becomes a child of the new node. */
  async insertNodeAbove(
    projectId: string,
    anchorId: string,
    label: string,
    status: Node['status']
  ): Promise<{ newNode: Node; anchor: Node }> {
    const { data: anchorRow, error: e0 } = await supabase
      .from('nodes')
      .select('*')
      .eq('id', anchorId)
      .single();

    if (e0) throw e0;
    const anchor = anchorRow as Node;
    if (anchor.parent_node_id == null) {
      throw new Error('Cannot insert above the project root');
    }

    const { data: inserted, error: e1 } = await supabase
      .from('nodes')
      .insert({
        project_id: projectId,
        parent_node_id: anchor.parent_node_id,
        label,
        node_type: 'PERSON',
        status,
      })
      .select()
      .single();

    if (e1) throw e1;
    const newNode = inserted as Node;

    const { data: updated, error: e2 } = await supabase
      .from('nodes')
      .update({ parent_node_id: newNode.id })
      .eq('id', anchorId)
      .select()
      .single();

    if (e2) throw e2;
    return { newNode, anchor: updated as Node };
  },

  async reparentNode(movingId: string, newParentId: string) {
    if (movingId === newParentId) return;

    const { data: row, error: e0 } = await supabase
      .from('nodes')
      .select('id, project_id, parent_node_id, node_type')
      .eq('id', movingId)
      .single();
    if (e0) throw e0;
    const M = row as Pick<Node, 'id' | 'project_id' | 'parent_node_id' | 'node_type'>;
    if (M.node_type === 'ROOT') throw new Error('Cannot move project root');

    const { data: edges, error: e1 } = await supabase
      .from('nodes')
      .select('id, parent_node_id')
      .eq('project_id', M.project_id);
    if (e1) throw e1;

    const cmap = new Map<string, string[]>();
    for (const e of edges ?? []) {
      const pid = (e as { parent_node_id: string | null }).parent_node_id;
      if (pid == null) continue;
      if (!cmap.has(pid)) cmap.set(pid, []);
      cmap.get(pid)!.push((e as { id: string }).id);
    }
    const block = new Set<string>();
    const stack = [movingId];
    while (stack.length) {
      const id = stack.pop()!;
      if (block.has(id)) continue;
      block.add(id);
      for (const c of cmap.get(id) ?? []) stack.push(c);
    }
    if (block.has(newParentId)) {
      throw new Error('Cannot move under a descendant of this node');
    }

    const { error: e2 } = await supabase
      .from('nodes')
      .update({ parent_node_id: newParentId })
      .eq('id', movingId);
    if (e2) throw e2;
  },

  async setSiblingOrderUnderParent(parentId: string, orderedIds: string[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('nodes')
        .update({ job_position: String((i + 1) * 1000) })
        .eq('id', orderedIds[i]);
      if (error) throw error;
    }
  },

  /**
   * Reparent then apply sibling order so layout matches drop intent (between / first / last / below).
   *
   * **Below** (parent↔child drop circle): insert between parent and their existing child row — the
   * dragged node becomes the new direct child of the parent, and the parent’s *previous* direct
   * children (except the one being moved) are reparented under the dragged node, preserving
   * their order. Example: Team2 had Member1; drag Test into the slot under Team2 → Team2 → Test
   * → Member1.
   */
  async reparentWithSiblingPlacement(
    movingId: string,
    newParentId: string,
    placement: SiblingDropPlacement
  ) {
    await nodeService.reparentNode(movingId, newParentId);

    const { data: rows, error } = await supabase.from('nodes').select('*').eq('parent_node_id', newParentId);
    if (error) throw error;
    const kids = (rows ?? []) as Node[];
    const others = kids.filter((n) => n.id !== movingId).sort(compareSiblingOrder);

    if (placement.kind === 'below') {
      if (others.length > 0) {
        for (const o of others) {
          await nodeService.reparentNode(o.id, movingId);
        }
        await nodeService.setSiblingOrderUnderParent(movingId, others.map((n) => n.id));
      }
      await nodeService.setSiblingOrderUnderParent(newParentId, [movingId]);
      return;
    }

    let orderedIds: string[];
    if (placement.kind === 'between') {
      const li = others.findIndex((n) => n.id === placement.leftId);
      const ri = others.findIndex((n) => n.id === placement.rightId);
      if (li < 0 || ri < 0 || ri !== li + 1) {
        throw new Error('Invalid between drop');
      }
      orderedIds = [
        ...others.slice(0, li + 1).map((n) => n.id),
        movingId,
        ...others.slice(li + 1).map((n) => n.id),
      ];
    } else if (placement.kind === 'first') {
      orderedIds = [movingId, ...others.map((n) => n.id)];
    } else {
      orderedIds = [...others.map((n) => n.id), movingId];
    }

    await nodeService.setSiblingOrderUnderParent(newParentId, orderedIds);
  },

  /**
   * Swap two nodes' positions in the tree while keeping the rest of the tree stable.
   * Children stay in place by swapping each node's direct child set as well.
   */
  async swapNodes(aId: string, bId: string) {
    if (aId === bId) return;

    const { data: A, error: ea } = await supabase.from('nodes').select('*').eq('id', aId).single();
    const { data: B, error: eb } = await supabase.from('nodes').select('*').eq('id', bId).single();
    if (ea || eb) throw ea ?? eb;
    const a = A as Node;
    const b = B as Node;
    if (a.node_type === 'ROOT' || b.node_type === 'ROOT') {
      throw new Error('Cannot swap with project root');
    }

    const { data: edgeRows, error: e0 } = await supabase
      .from('nodes')
      .select('id, parent_node_id')
      .eq('project_id', a.project_id);
    if (e0) throw e0;

    const cmap = new Map<string, string[]>();
    for (const e of edgeRows ?? []) {
      const pid = (e as { parent_node_id: string | null }).parent_node_id;
      if (pid == null) continue;
      if (!cmap.has(pid)) cmap.set(pid, []);
      cmap.get(pid)!.push((e as { id: string }).id);
    }
    const descendants = (rootId: string) => {
      const out = new Set<string>();
      const st = [rootId];
      while (st.length) {
        const id = st.pop()!;
        if (out.has(id)) continue;
        out.add(id);
        for (const c of cmap.get(id) ?? []) st.push(c);
      }
      return out;
    };

    const pa = a.parent_node_id;
    const pb = b.parent_node_id;
    const listChildIds = async (parentId: string) => {
      const { data, error } = await supabase.from('nodes').select('id').eq('parent_node_id', parentId);
      if (error) throw error;
      return (data ?? []).map((r: { id: string }) => r.id);
    };
    const ca = await listChildIds(aId);
    const cb = await listChildIds(bId);

    if (pb === aId) {
      const { error: u1 } = await supabase.from('nodes').update({ parent_node_id: pa }).eq('id', bId);
      if (u1) throw u1;
      const { error: u2 } = await supabase.from('nodes').update({ parent_node_id: bId }).eq('id', aId);
      if (u2) throw u2;
      for (const id of ca) {
        if (id === bId) continue;
        const { error: u } = await supabase.from('nodes').update({ parent_node_id: bId }).eq('id', id);
        if (u) throw u;
      }
      for (const id of cb) {
        const { error: u } = await supabase.from('nodes').update({ parent_node_id: aId }).eq('id', id);
        if (u) throw u;
      }
    } else if (pa === bId) {
      const { error: u1 } = await supabase.from('nodes').update({ parent_node_id: pb }).eq('id', aId);
      if (u1) throw u1;
      const { error: u2 } = await supabase.from('nodes').update({ parent_node_id: aId }).eq('id', bId);
      if (u2) throw u2;
      for (const id of cb) {
        if (id === aId) continue;
        const { error: u } = await supabase.from('nodes').update({ parent_node_id: aId }).eq('id', id);
        if (u) throw u;
      }
      for (const id of ca) {
        const { error: u } = await supabase.from('nodes').update({ parent_node_id: bId }).eq('id', id);
        if (u) throw u;
      }
    } else {
      const da = descendants(aId);
      const db = descendants(bId);
      if (da.has(bId) || db.has(aId)) {
        throw new Error('Invalid swap target');
      }

      if (pa !== pb) {
        const { error: u1 } = await supabase.from('nodes').update({ parent_node_id: pb }).eq('id', aId);
        if (u1) throw u1;
        const { error: u2 } = await supabase.from('nodes').update({ parent_node_id: pa }).eq('id', bId);
        if (u2) throw u2;
      }
      for (const id of ca) {
        const { error: u } = await supabase.from('nodes').update({ parent_node_id: bId }).eq('id', id);
        if (u) throw u;
      }
      for (const id of cb) {
        const { error: u } = await supabase.from('nodes').update({ parent_node_id: aId }).eq('id', id);
        if (u) throw u;
      }
    }

    const { error: up1 } = await supabase
      .from('nodes')
      .update({ job_position: b.job_position ?? null })
      .eq('id', aId);
    if (up1) throw up1;
    const { error: up2 } = await supabase
      .from('nodes')
      .update({ job_position: a.job_position ?? null })
      .eq('id', bId);
    if (up2) throw up2;
  },
};
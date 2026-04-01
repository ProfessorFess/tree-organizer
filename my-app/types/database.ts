export type Node = {
    id: string;
    project_id: string;
    parent_node_id: string | null;
    node_type: 'ROOT' | 'TEAM' | 'PERSON';
    label: string;
    status: 'active' | 'stuck' | 'completed';
    job_position?: string;
};

export type Task = {
    id: string;
    node_id: string;
    title: string;
    is_done: boolean;
};
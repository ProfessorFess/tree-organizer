export type StatusDefinition = {
  project_id?: string;
  key: string;
  label: string;
  color: string;
};

export type NodeStatusOverride = {
  project_id: string;
  node_id: string;
  status_key: string;
};


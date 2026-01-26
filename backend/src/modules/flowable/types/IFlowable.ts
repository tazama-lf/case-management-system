export interface FlowableVariable {
  name: string;
  value: string | boolean | number;
  type: 'string' | 'boolean' | 'integer';
}

export interface FlowableTask {
  id: string;
  name: string;
  description?: string;
  assignee?: string;
  category?: string;
  candidateGroups?: string[];
  tenantId?: string;
  processInstanceId: string;
  variables?: FlowableVariable[];
  variablesMap?: Record<string, string>;
  created?: string;
  dueDate?: string;
  priority?: number;
}

export interface FlowableProcessInstance {
  id: string;
  businessKey: string;
  processDefinitionId: string;
  processDefinitionKey?: string;
  tenantId: string;
  suspended: boolean;
  ended?: boolean;
  variables?: FlowableVariable[];
}

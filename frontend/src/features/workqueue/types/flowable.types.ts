

export interface FlowableTask {
  id: string;
  name: string;
  description?: string;
  assignee?: string;
  owner?: string;
  delegationState?: 'PENDING' | 'RESOLVED';
  createTime: string;
  dueDate?: string;
  priority: number;
  suspended: boolean;
  taskDefinitionKey: string;
  formKey?: string;
  tenantId?: string;
  category?: string;

  processInstanceId: string;
  processDefinitionId: string;
  processDefinitionKey: string;
  processDefinitionName?: string;

  executionId: string;
  parentTaskId?: string;

  candidateGroups?: string[];
  candidateUsers?: string[];

  taskLocalVariables?: Record<string, any>;
  processVariables?: Record<string, any>;

  caseInstanceId?: string;
  caseDefinitionId?: string;
}


export interface FlowableTaskListResponse {
  data: FlowableTask[];
  total: number;
  start: number;
  sort: string;
  order: string;
  size: number;
}


export interface FlowableErrorResponse {
  message: string;
  exception?: string;
  error: string;
  timestamp: string;
  path: string;
}


export const WorkQueueCandidateGroup = {
  INVESTIGATIONS: 'investigations',
  INVESTIGATORS: 'investigators',
  SUPERVISORS: 'supervisors'
} as const;

export type WorkQueueCandidateGroupType = typeof WorkQueueCandidateGroup[keyof typeof WorkQueueCandidateGroup];


export interface FlowableWorkQueueFilters {
  candidateGroup?: WorkQueueCandidateGroupType | string;
  assignee?: string;
  owner?: string;
  processDefinitionKey?: string;
  processInstanceId?: string;
  createdAfter?: string;
  createdBefore?: string;
  dueAfter?: string;
  dueBefore?: string;
  priority?: number;
  suspended?: boolean;

  start?: number;
  size?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}


export interface UnifiedWorkQueueTask {
  id: string;
  taskId: string;
  name: string;
  description?: string;

  assignee?: string;
  assigneeName?: string;
  candidateGroup?: string;

  status: 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED';
  priority: 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH';

  createdAt: string;
  dueDate?: string;

  processInstanceId: string;
  caseId?: string;

  flowableData?: FlowableTask;

  case?: {
    case_id: string;
    priority: string;
    status: string;
    created_at: string;
  };
}


export interface WorkQueueResponse {
  tasks: UnifiedWorkQueueTask[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  candidateGroup?: string;
}


export interface FlowableTaskAssignmentRequest {
  assignee: string;
  owner?: string;
}


export interface FlowableTaskCompletionRequest {
  variables?: Record<string, any>;
  localVariables?: Record<string, any>;
}


export interface CaseProcessVariables {
  caseId: string;
  caseType: 'FRAUD' | 'AML' | 'FRAUD_AND_AML';
  priority: 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH';
  assignedInvestigator?: string;
  supervisorId?: string;
  createdBy: string;
  alertIds?: string[];
  investigationNotes?: string;
  riskScore?: number;
  complianceFlags?: string[];
}
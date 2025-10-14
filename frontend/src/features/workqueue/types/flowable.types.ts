// Flowable BPM Types for Work Queue Integration

/**
 * Flowable Task Response - matches what Flowable BPM engine returns
 */
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
  
  // Process-related fields
  processInstanceId: string;
  processDefinitionId: string;
  processDefinitionKey: string;
  processDefinitionName?: string;
  
  // Execution context
  executionId: string;
  parentTaskId?: string;
  
  // Candidate groups and users
  candidateGroups?: string[];
  candidateUsers?: string[];
  
  // Custom properties
  taskLocalVariables?: Record<string, any>;
  processVariables?: Record<string, any>;
  
  // Case management specific
  caseInstanceId?: string;
  caseDefinitionId?: string;
}

/**
 * Flowable Task List Response with pagination
 */
export interface FlowableTaskListResponse {
  data: FlowableTask[];
  total: number;
  start: number;
  sort: string;
  order: string;
  size: number;
}

/**
 * Flowable Error Response structure
 */
export interface FlowableErrorResponse {
  message: string;
  exception?: string;
  error: string;
  timestamp: string;
  path: string;
}

/**
 * Work Queue specific candidate groups (matching actual Flowable groups)
 */
export const WorkQueueCandidateGroup = {
  INVESTIGATIONS: 'investigations',
  INVESTIGATORS: 'investigators',
  SUPERVISORS: 'supervisors'
} as const;

export type WorkQueueCandidateGroupType = typeof WorkQueueCandidateGroup[keyof typeof WorkQueueCandidateGroup];

/**
 */
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
  
  // Pagination
  start?: number;
  size?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Unified task interface that bridges Flowable and Prisma data
 */
export interface UnifiedWorkQueueTask {
  // Core identifiers
  id: string; // Flowable task ID
  taskId: string; // For compatibility
  name: string;
  description?: string;
  
  // Assignment
  assignee?: string;
  assigneeName?: string;
  candidateGroup?: string;
  
  // Status and priority
  status: 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED';
  priority: 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH';
  
  // Timestamps
  createdAt: string;
  dueDate?: string;
  
  // Process context
  processInstanceId: string;
  caseId?: string;
  
  // Flowable specific
  flowableData?: FlowableTask;
  
  // Case data (if available)
  case?: {
    case_id: string;
    priority: string;
    status: string;
    created_at: string;
  };
}

/**
 * Work queue response with unified tasks
 */
export interface WorkQueueResponse {
  tasks: UnifiedWorkQueueTask[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
  candidateGroup?: string;
}

/**
 * Task assignment request for Flowable
 */
export interface FlowableTaskAssignmentRequest {
  assignee: string;
  owner?: string;
}

/**
 * Task completion request for Flowable
 */
export interface FlowableTaskCompletionRequest {
  variables?: Record<string, any>;
  localVariables?: Record<string, any>;
}

/**
 * Flowable process variables commonly used in case management
 */
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
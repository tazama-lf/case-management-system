/**
 * Flowable variable format for API requests
 */
export interface FlowableVariable {
  name: string;
  value: string;
  type: 'string' | 'boolean' | 'integer';
}

/**
 * Flowable task representation
 */
export interface FlowableTask {
  id: string;
  name: string;
  description?: string;
  assignee?: string;
  candidateGroups?: string[];
  tenantId?: string;
  processInstanceId?: string;
  variables?: FlowableVariable[];
  variablesMap?: Record<string, string>;
  created?: string;
  dueDate?: string;
  priority?: number;
}

/**
 * Flowable process instance representation
 */
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

/**
 * Standard task variables used for PostgreSQL ↔ Flowable sync
 */
export interface FlowableTaskVariables {
  postgres_task_id?: string;
  postgres_case_id?: string;
  task_status?: string;
  task_name?: string;
  candidate_group?: string;
  flowable_case_id?: string;
  assignee_user_id?: string;
  reassigned_from?: string;
  reassigned_at?: string;
  unassigned_from?: string;
  unassigned_at?: string;
  unassignment_reason?: string;
  task_completed?: string;
  completed_at?: string;
  completed_by?: string;
}

/**
 * DTO for creating a new Flowable task
 */
export interface CreateFlowableTaskDto {
  name: string;
  description?: string;
  assignee?: string;
  variables?: Record<string, string>;
}

/**
 * DTO for starting a new process instance
 */
export interface StartProcessInstanceDto {
  processDefinitionKey: string;
  variables: Record<string, string>;
  businessKey: string;
  tenantId?: string;
}

/**
 * DTO for completing a task
 */
export interface CompleteTaskDto {
  taskId: string;
  variables?: Record<string, string>;
}

/**
 * Flowable group representation
 */
export interface FlowableGroup {
  id: string;
  name: string;
  type: string;
}

/**
 * Flowable deployment representation
 */
export interface FlowableDeployment {
  id: string;
  name: string;
  deploymentTime: string;
  category?: string;
  tenantId?: string;
}

/**
 * Flowable process definition
 */
export interface FlowableProcessDefinition {
  id: string;
  key: string;
  name: string;
  version: number;
  deploymentId: string;
  tenantId?: string;
  suspended?: boolean;
}

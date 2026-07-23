/**
 * Flowable REST API endpoint constants
 * Centralizes all API paths for easier maintenance and testing
 */
export const FlowableApiEndpoints = {
  // Repository endpoints
  DEPLOYMENTS: '/service/repository/deployments',
  PROCESS_DEFINITIONS: '/service/repository/process-definitions',

  // Runtime endpoints - Process Instances
  PROCESS_INSTANCES: '/service/runtime/process-instances',
  PROCESS_INSTANCE: (id: string) => `/service/runtime/process-instances/${id}`,
  PROCESS_INSTANCE_VARIABLES: (id: string) => `/service/runtime/process-instances/${id}/variables`,
  PROCESS_INSTANCE_VARIABLE: (id: string, name: string) => `/service/runtime/process-instances/${id}/variables/${name}`,

  // Runtime endpoints - Tasks
  TASKS: '/service/runtime/tasks',
  TASK: (id: string) => `/service/runtime/tasks/${id}`,
  TASK_VARIABLES: (id: number) => `/service/runtime/tasks/${id}/variables`,
  TASK_VARIABLE: (id: number, name: string) => `/service/runtime/tasks/${id}/variables/${name}`,
  TASK_IDENTITY_LINKS: (id: number) => `/service/runtime/tasks/${id}/identitylinks`,

  // Identity endpoints
  GROUPS: '/service/identity/groups',
  GROUP: (id: string) => `/service/identity/groups/${id}`,
  GROUP_MEMBERS: (groupId: string) => `/service/identity/groups/${groupId}/members`,
  GROUP_MEMBER: (groupId: string, userId: string) => `/service/identity/groups/${groupId}/members/${userId}`,
} as const;

/**
 * Flowable task action constants
 */
export const FlowableTaskActions = {
  COMPLETE: 'complete',
  CLAIM: 'claim',
  DELEGATE: 'delegate',
  DELETE: 'delete',
  SUSPEND: 'suspend',
  ACTIVATE: 'activate',
} as const;

/**
 * Flowable identity link types
 */
export const FlowableIdentityLinkTypes = {
  CANDIDATE: 'candidate',
  ASSIGNEE: 'assignee',
  OWNER: 'owner',
  PARTICIPANT: 'participant',
} as const;

/**
 * Default configuration values
 */
export const FlowableDefaults = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  TIMEOUT_MS: 30000,
  DEFAULT_PRIORITY: 50,
  EVENT_DEBOUNCE_MS: 1000,
  MAX_CACHE_SIZE: 1000,
  BPMN_SYNC_DELAY_MS: 3000,
} as const;

/**
 * BPMN task names that should be created by the workflow process
 */
export const BpmnTaskNames = {
  INVESTIGATE_CASE: 'Investigate Case',
  APPROVE_CASE_CREATION: 'Approve Case Creation',
  APPROVE_CASE_CLOSURE: 'Approve case closure',
} as const;

/**
 * Candidate group names
 */
export const CandidateGroups = {
  SUPERVISORS: 'supervisors',
  INVESTIGATIONS: 'investigations',
  INVESTIGATOR: 'investigator',
} as const;

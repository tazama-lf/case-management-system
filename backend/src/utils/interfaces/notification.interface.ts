export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_AVAILABLE'
  | 'TASK_UNASSIGNED'
  | 'TASK_REASSIGNED'
  | 'WORK_QUEUE'
  | 'CASE_SUSPENDED'
  | 'CASE_RESUMED'
  | 'CASE_CLOSURE_PENDING'
  | 'CASE_CLOSURE_APPROVED'
  | 'CASE_CLOSURE_REJECTED'
  | 'CASE_REOPENED_ASSIGNED'
  | 'CASE_REOPENED_AVAILABLE'
  | 'CASE_REOPENING_REJECTED'
  | 'TASK_SLA_WARNING'
  | 'TASK_SLA_BREACH'
  | 'TASK_OVERDUE'
  | 'GENERIC';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  message: string;
  metadata?: Record<string, any>;
}

export interface GroupNotificationPayload {
  candidateGroup: string;
  type: NotificationType;
  message: string;
  metadata?: Record<string, any>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export interface SlaEventPayload {
  taskId: string;
  taskName: string;
  caseId: string;
  casePriority: string;
  workQueueId: string;
  workQueueName: string;
  assignedUserId?: string;
  deadline?: string;
  tenantId: string;
}

export interface SlaWarningPayload extends SlaEventPayload {
  timeUntilDeadline: number;
}

export interface SlaBreachPayload extends SlaEventPayload {
  breachDuration: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
}

export interface TaskEventPayload {
  taskId: string;
  taskName: string;
  taskType: string;
  caseId: string;
  caseNumber: string;
  casePriority: string;
  assignedUserId: string;
  assignedBy?: string;
  slaDeadline?: string;
  workQueueName: string;
  tenantId: string;
}

export interface TaskReassignedPayload extends Omit<TaskEventPayload, 'assignedUserId'> {
  previousAssignedUserId: string;
  newAssignedUserId: string;
  reassignedBy?: string;
  reason?: string;
}

export interface OverdueTaskPayload extends Omit<SlaEventPayload, 'deadline'> {
  createdAt: string;
  hoursSinceCreation: number;
}

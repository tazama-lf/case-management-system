// Task-related types for Cases feature

export interface UnifiedWorkQueueTask {
  id: number;
  taskId?: number;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  assignee?: string;
  assigneeName?: string;
  candidateGroup?: string;
  created?: string;
  createdAt?: string; // Alternative property name for compatibility
  dueDate?: string;
  caseId?: number;
  caseName?: string;
  taskType?: string;
  investigationNotes?: string;
  completedAt?: string;
  slaDeadline?: string;
  processInstanceId?: string;
  flowableData?: string;
}

import { formatDate } from '@/shared/utils/dateUtils';
import type { CaseWithTasksDto, TaskDTO } from '../services/caseService';

export type CaseRow = {
  id: number;
  type: string;
  typeColor: string;
  status: string;
  statusColor: string;
  typologyId: string;
  score: number;
  createdOn: string;
  pickedOn: string;
  action: 'View' | 'Complete';
  assignee?: string;
  priority: string;
  userRole: 'owner' | 'task_assignee' | 'both' | 'none';
  totalTasks: number;
  alertId?: number;
  alertMessage?: string;
  confidencePercent?: number;
  transaction?: unknown;
  tasks?: TaskDTO[];
  parentId?: number;
  sarStrStatus?: string;
};

export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    STATUS_00_DRAFT: 'bg-gray-100 text-gray-700',
    STATUS_02_READY_FOR_ASSIGNMENT: 'bg-indigo-50 text-indigo-700',
    STATUS_10_ASSIGNED: 'bg-blue-50 text-blue-700',
    STATUS_20_IN_PROGRESS: 'bg-yellow-50 text-yellow-700',
    STATUS_22_PENDING_FINAL_APPROVAL: 'bg-purple-50 text-purple-700',
    STATUS_31_REOPENED: 'bg-orange-50 text-orange-700',
    STATUS_81_CLOSED_REFUTED: 'bg-red-50 text-red-700',
    STATUS_82_CLOSED_CONFIRMED: 'bg-green-50 text-green-700',
    STATUS_83_CLOSED_INCONCLUSIVE: 'bg-gray-50 text-gray-700',
    STATUS_84_COMPLETED: 'bg-green-50 text-green-700',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-700';
};

export const getTypeColor = (caseType: string): string => {
  const typeColors: Record<string, string> = {
    FRAUD: 'bg-red-50 text-red-700 ring-red-200',
    AML: 'bg-purple-50 text-purple-700 ring-purple-200',
    FRAUD_AND_AML: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  };
  return typeColors[caseType] || 'bg-gray-50 text-gray-700 ring-gray-200';
};

export const getPriorityColor = (priority: string): string => {
  const priorityColors: Record<string, string> = {
    NEW: 'bg-blue-50 text-blue-700 ring-blue-200',
    URGENT: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    CRITICAL: 'bg-orange-50 text-orange-700 ring-orange-200',
    BREACH: 'bg-red-50 text-red-700 ring-red-200',
  };
  return priorityColors[priority] || 'bg-gray-50 text-gray-700 ring-gray-200';
};

export const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-red-600 bg-red-50';
  if (score >= 60) return 'text-orange-600 bg-orange-50';
  if (score >= 40) return 'text-yellow-600 bg-yellow-50';
  if (score > 0) return 'text-green-600 bg-green-50';
  return 'text-gray-600 bg-gray-50';
};

export const formatStatus = (status: string): string => {
  return status;
};

export const getSarStrStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    STATUS_01_UNASSIGNED: 'bg-gray-100 text-gray-700',
    STATUS_10_ASSIGNED: 'bg-blue-50 text-blue-700',
    STATUS_20_IN_PROGRESS: 'bg-yellow-50 text-yellow-700',
    STATUS_30_COMPLETED: 'bg-green-50 text-green-700',
    'N/A': 'bg-gray-100 text-gray-500',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-700';
};

export const formatSarStrStatus = (status: string): string => {
  const statusLabels: Record<string, string> = {
    STATUS_01_UNASSIGNED: 'Unassigned',
    STATUS_10_ASSIGNED: 'Assigned',
    STATUS_20_IN_PROGRESS: 'In Progress',
    STATUS_30_COMPLETED: 'Completed',
    'N/A': 'N/A',
  };
  return statusLabels[status] || status;
};

export const transformBackendCaseToUI = (backendCase: CaseWithTasksDto): CaseRow => {
  // Find SAR/STR Filing task status
  const sarStrTask = backendCase.tasks?.find(
    task => task.name === 'SAR_STR_FILING' || task.name === 'SAR/STR Filing' || task.name === 'File SAR/STR Report'
  );
  const sarStrStatus = sarStrTask?.status || 'N/A';

  return {
    id: backendCase.case_id,
    type: backendCase.case_type,
    typeColor: getTypeColor(backendCase.case_type),
    status: formatStatus(backendCase.status),
    statusColor: getStatusColor(backendCase.status),
    typologyId: backendCase.alert?.alert_id?.toString().substring(0, 8) || 'N/A',
    score: backendCase.alert?.confidence_per || 0,
    createdOn: formatDate(backendCase.created_at),
    pickedOn: backendCase.user_role === 'owner' ? new Date(backendCase.updated_at).toLocaleDateString('en-GB') : '-',
    action: backendCase.status === 'STATUS_00_DRAFT' ? 'Complete' : 'View',
    assignee: backendCase.user_role === 'owner' ? 'Current User' : 'Assigned User', //Check with Umair
    priority: backendCase.priority,
    userRole: backendCase.user_role,
    totalTasks: backendCase.total_tasks,
    alertId: backendCase.alert?.alert_id,
    alertMessage: backendCase.alert?.message,
    confidencePercent: backendCase.alert?.confidence_per,
    transaction: backendCase.alert?.transaction,
    tasks: backendCase.tasks,
    parentId: backendCase?.parent_id,
    sarStrStatus: sarStrStatus,
  };
};

// Color utilities for case management system

export const CaseType = {
  FRAUD: 'FRAUD',
  AML: 'AML',
  FRAUD_AND_AML: 'FRAUD_AND_AML',
  NONE: 'NONE'
} as const;

export type CaseType = typeof CaseType[keyof typeof CaseType];

export const TaskStatus = {
  STATUS_30_COMPLETED: 'STATUS_30_COMPLETED',
  STATUS_20_IN_PROGRESS: 'STATUS_20_IN_PROGRESS',
  STATUS_01_UNASSIGNED: 'STATUS_01_UNASSIGNED',
  STATUS_21_BLOCKED: 'STATUS_21_BLOCKED',
  STATUS_10_ASSIGNED: 'STATUS_10_ASSIGNED'
} as const;

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

/**
 * Get color for case type
 */
export function getCaseTypeColor(caseType: CaseType | string | null): string {
  switch (caseType) {
    case CaseType.FRAUD:
    case 'FRAUD':
      return '#ef4444'; // Red
    case CaseType.AML:
    case 'AML':
      return '#8b5cf6'; // Purple
    case CaseType.FRAUD_AND_AML:
    case 'FRAUD_AND_AML':
      return '#f59e0b'; // Orange
    case CaseType.NONE:
    case 'NONE':
    default:
      return '#3b82f6'; // Blue
  }
}

/**
 * Get color for task status
 */
export function getTaskStatusColor(status: TaskStatus | string): string {
  switch (status) {
    case TaskStatus.STATUS_30_COMPLETED:
    case 'STATUS_30_COMPLETED':
      return '#10b981'; // Green
    case TaskStatus.STATUS_20_IN_PROGRESS:
    case 'STATUS_20_IN_PROGRESS':
      return '#3b82f6'; // Blue
    case TaskStatus.STATUS_01_UNASSIGNED:
    case 'STATUS_01_UNASSIGNED':
      return '#6b7280'; // Gray
    case TaskStatus.STATUS_21_BLOCKED:
    case 'STATUS_21_BLOCKED':
      return '#f59e0b'; // Orange
    case TaskStatus.STATUS_10_ASSIGNED:
    case 'STATUS_10_ASSIGNED':
      return '#8b5cf6'; // Purple
    default:
      return '#6b7280'; // Gray
  }
}

/**
 * Get Tailwind CSS class for case type
 */
export function getCaseTypeColorClass(caseType: CaseType | string | null): string {
  switch (caseType) {
    case CaseType.FRAUD:
    case 'FRAUD':
      return 'text-red-500 bg-red-50 border-red-200';
    case CaseType.AML:
    case 'AML':
      return 'text-purple-500 bg-purple-50 border-purple-200';
    case CaseType.FRAUD_AND_AML:
    case 'FRAUD_AND_AML':
      return 'text-orange-500 bg-orange-50 border-orange-200';
    case CaseType.NONE:
    case 'NONE':
    default:
      return 'text-blue-500 bg-blue-50 border-blue-200';
  }
}

/**
 * Get Tailwind CSS class for task status
 */
export function getTaskStatusColorClass(status: TaskStatus | string): string {
  switch (status) {
    case TaskStatus.STATUS_30_COMPLETED:
    case 'STATUS_30_COMPLETED':
      return 'text-green-500 bg-green-50 border-green-200';
    case TaskStatus.STATUS_20_IN_PROGRESS:
    case 'STATUS_20_IN_PROGRESS':
      return 'text-blue-500 bg-blue-50 border-blue-200';
    case TaskStatus.STATUS_01_UNASSIGNED:
    case 'STATUS_01_UNASSIGNED':
      return 'text-gray-500 bg-gray-50 border-gray-200';
    case TaskStatus.STATUS_21_BLOCKED:
    case 'STATUS_21_BLOCKED':
      return 'text-orange-500 bg-orange-50 border-orange-200';
    case TaskStatus.STATUS_10_ASSIGNED:
    case 'STATUS_10_ASSIGNED':
      return 'text-purple-500 bg-purple-50 border-purple-200';
    default:
      return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}
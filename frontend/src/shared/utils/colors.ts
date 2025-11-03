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
 * Get display name for case type
 */
export function getCaseTypeDisplay(caseType: CaseType | string | null): string {
  switch (caseType) {
    case CaseType.FRAUD:
    case 'FRAUD':
      return 'Fraud';
    case CaseType.AML:
    case 'AML':
      return 'AML';
    case CaseType.FRAUD_AND_AML:
    case 'FRAUD_AND_AML':
      return 'Fraud & AML';
    case CaseType.NONE:
    case 'NONE':
    default:
      return 'None';
  }
}

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
      return '#f59e0b'; 
    case TaskStatus.STATUS_10_ASSIGNED:
    case 'STATUS_10_ASSIGNED':
      return '#8b5cf6'; 
    default:
      return '#6b7280'; 
  }
}

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

/**
 * Get Tailwind CSS class for case status
 */
export function getCaseStatusColorClass(status: string): string {
  const statusColors: Record<string, string> = {
    'STATUS_00_DRAFT': 'bg-gray-100 text-gray-700',
    'STATUS_02_READY_FOR_ASSIGNMENT': 'bg-indigo-50 text-indigo-700',
    'STATUS_10_ASSIGNED': 'bg-blue-50 text-blue-700',
    'STATUS_20_IN_PROGRESS': 'bg-yellow-50 text-yellow-700',
    'STATUS_22_PENDING_FINAL_APPROVAL': 'bg-purple-50 text-purple-700',
    'STATUS_31_REOPENED': 'bg-orange-50 text-orange-700',
    'STATUS_81_CLOSED_REFUTED': 'bg-red-50 text-red-700',
    'STATUS_82_CLOSED_CONFIRMED': 'bg-green-50 text-green-700',
    'STATUS_83_CLOSED_INCONCLUSIVE': 'bg-gray-50 text-gray-700',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-700';
}

/**
 * Get Tailwind CSS class for case type
 */
export function getTypeColorClass(caseType: string): string {
  const typeColors: Record<string, string> = {
    'FRAUD': 'bg-red-50 text-red-700 ring-red-200',
    'AML': 'bg-purple-50 text-purple-700 ring-purple-200',
    'FRAUD_AND_AML': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  };
  return typeColors[caseType] || 'bg-gray-50 text-gray-700 ring-gray-200';
}

/**
 * Get Tailwind CSS class for priority
 */
export function getPriorityColorClass(priority: string): string {
  const priorityColors: Record<string, string> = {
    'NEW': 'bg-blue-50 text-blue-700 ring-blue-200',
    'URGENT': 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    'CRITICAL': 'bg-orange-50 text-orange-700 ring-orange-200',
    'BREACH': 'bg-red-50 text-red-700 ring-red-200',
  };
  return priorityColors[priority] || 'bg-gray-50 text-gray-700 ring-gray-200';
}

/**
 * Get Tailwind CSS class for audit log type
 */
export function getAuditTypeColorClass(type: string): string {
  if (!type) return 'bg-blue-100 text-blue-800';

  switch (type) {
    case 'Success': return 'bg-green-100 text-green-800';
    case 'Warning': return 'bg-yellow-100 text-yellow-800';
    case 'Error': return 'bg-red-100 text-red-800';
    default: return 'bg-blue-100 text-blue-800';
  }
}

/**
 * Get risk score color class based on score value
 */
export function getRiskScoreColorClass(score: number | string): string {
  const numScore = typeof score === 'string' ? parseInt(score, 10) : score;
  if (numScore >= 800) return 'bg-red-100 text-red-800';
  if (numScore >= 600) return 'bg-orange-100 text-orange-800';
  if (numScore >= 400) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

/**
 * Get type badge color for alerts
 */
export function getAlertTypeBadgeColor(type: string): string {
  switch (type?.toLowerCase()) {
    case 'fraud':
      return 'bg-red-100 text-red-800';
    case 'aml':
      return 'bg-blue-100 text-blue-800';
    case 'fraud_and_aml':
    case 'fraud and aml':
      return 'bg-purple-100 text-purple-800';
    case 'suspicious':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
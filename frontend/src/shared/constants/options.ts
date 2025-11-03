export const DATE_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastYear', label: 'Last Year' }
];

export const REPORT_TYPE_OPTIONS = [
  { value: 'CASE_STATUS', label: 'Case Status Report' },
  { value: 'CASE_OUTCOME', label: 'Case Outcome Report' },
  { value: 'CASE_TYPES', label: 'Case Types Report' }
];

export const CASE_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'FRAUD', label: 'Fraud' },
  { value: 'AML', label: 'AML' },
  { value: 'FRAUD_AND_AML', label: 'Fraud and AML' }
];

export const TASK_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'SUSPENDED', label: 'Suspended' }
];

export const TRIAGE_TYPE_OPTIONS = [
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'AI', label: 'AI' },
  { value: 'MANUAL', label: 'Manual' }
];

export const SORT_OPTIONS = [
  { value: 'desc', label: 'Case ID ↓' },
  { value: 'asc', label: 'Status ↑' },
  { value: 'asc', label: 'Typology ID ↑' }
];

export const EXPORT_ACTIONS = [
  { type: 'excel', label: 'Export as Excel' },
  { type: 'csv', label: 'Export as CSV' },
  { type: 'pdf', label: 'Export as PDF' }
];

export const REPORT_TABLE_HEADERS = [
  'Status',
  'Count',
  'Percentage', 
  'Avg Time in Status',
  'Current Trend Period'
];

export const WORK_QUEUE_TABLE_HEADERS = [
  'Task ID',
  'Case ID',
  'Status',
  'Priority',
  'Assigned To',
  'Due Date',
  'Actions'
];

export const AUDIT_LOG_FILTER_FIELDS = [
  { key: 'userId', label: 'User ID', type: 'text' },
  { key: 'action', label: 'Action', type: 'text' },
  { key: 'startDate', label: 'Start Date', type: 'date' },
  { key: 'endDate', label: 'End Date', type: 'date' }
];

export const DATE_RANGE_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 Days',
  last30: 'Last 30 Days',
  last90: 'Last 90 Days',
  thisMonth: 'This Month',
  lastYear: 'Last Year'
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  CASE_STATUS: 'Case Status Report',
  CASE_OUTCOME: 'Case Outcome Report',
  CASE_TYPES: 'Case Types Report'
};
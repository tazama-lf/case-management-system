import React from 'react';

export const Priority = {
  NEW: 'NEW',
  URGENT: 'URGENT',
  CRITICAL: 'CRITICAL',
  BREACH: 'BREACH',
} as const;

export const AlertStatus = {
  NEW: 'NEW',
  INVESTIGATING: 'INVESTIGATING',
  CLOSED: 'CLOSED',
  CONVERTED: 'CONVERTED',
  AUTOCLOSED_CONFIRMED: 'AUTOCLOSED_CONFIRMED',
  AUTOCLOSED_REFUTED: 'AUTOCLOSED_REFUTED',
  SENT_FOR_INVESTIGATION: 'SENT_FOR_INVESTIGATION',
} as const;

export const AlertType = {
  FRAUD: 'FRAUD',
  AML: 'AML',
  FRAUD_AND_AML: 'FRAUD_AND_AML',
  NONE: 'NONE',
} as const;

export const CaseStatus = {
  STATUS_00_DRAFT: 'STATUS_00_DRAFT',
  STATUS_01_PENDING_CASE_CREATION_APPROVAL: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
  STATUS_02_READY_FOR_ASSIGNMENT: 'STATUS_02_READY_FOR_ASSIGNMENT',
  STATUS_03_RETURNED: 'STATUS_03_RETURNED',
  STATUS_10_ASSIGNED: 'STATUS_10_ASSIGNED',
  STATUS_20_IN_PROGRESS: 'STATUS_20_IN_PROGRESS',
  STATUS_21_SUSPENDED: 'STATUS_21_SUSPENDED',
  STATUS_22_PENDING_FINAL_APPROVAL: 'STATUS_22_PENDING_FINAL_APPROVAL',
  STATUS_30_PENDING_REOPENING: 'STATUS_30_PENDING_REOPENING',
  STATUS_31_REOPENED: 'STATUS_31_REOPENED',
  STATUS_71_AUTOCLOSED_CONFIRMED: 'STATUS_71_AUTOCLOSED_CONFIRMED',
  STATUS_72_AUTOCLOSED_REFUTED: 'STATUS_72_AUTOCLOSED_REFUTED',
  STATUS_81_CLOSED_REFUTED: 'STATUS_81_CLOSED_REFUTED',
  STATUS_82_CLOSED_CONFIRMED: 'STATUS_82_CLOSED_CONFIRMED',
  STATUS_83_CLOSED_INCONCLUSIVE: 'STATUS_83_CLOSED_INCONCLUSIVE',
  STATUS_99_ABANDONED: 'STATUS_99_ABANDONED',
} as const;

export interface ActionHistory {
  audit_log_id: number;
  user_id: string;
  operation: string;
  entity_name: string;
  action_performed: string;
  outcome: string;
  performed_at: string;
}


export const CaseType = {
  FRAUD: 'FRAUD',
  AML: 'AML',
  FRAUD_AND_AML: 'FRAUD_AND_AML',
} as const;

export const CaseCreationType = {
  MANUAL: 'MANUAL',
  ALERT_CONVERSION: 'ALERT_CONVERSION',
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];
export type AlertType = (typeof AlertType)[keyof typeof AlertType];
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];
export type CaseType = (typeof CaseType)[keyof typeof CaseType];
export type CaseCreationType =
  (typeof CaseCreationType)[keyof typeof CaseCreationType];

export interface AlertData {
  status?: string;
  metaData?: Record<string, unknown>;
  timestamp?: string;
  tadpResult?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Alert extends Record<string, unknown> {
  alert_id: number;
  tenant_id: string;
  priority: Priority;
  alert_type?: AlertType | null;
  source?: string;
  txtp?: string;
  message: string;
  alert_data?: AlertData;
  transaction: unknown;
  network_map: unknown;
  confidence_per: number;
  created_at: string;
  case_id?: number;
  prediction_outcome?: string;
}

export interface Case {
  case_id: number;
  case_creator_user_id: string;
  case_owner_user_id: string;
  tenant_id: string;
  status: CaseStatus;
  priority: Priority;
  created_at: string;
  updated_at: string;
  parent_id?: number;
  case_type: CaseType;
  case_creation_type: CaseCreationType;
}

export interface AlertsFilter {
  priority?: string;
  status?: string;
  type?: string;
  alertType?: string;
  source?: string;
  search?: string;
  reportStatus?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

export interface AlertsApiResponse {
  alerts: Alert[];
  pagination: PaginationResponse;
}


export interface ManualTriageDto {
  confidence_per?: number;
  priority?: Priority;
  priorityScore: number;
  alertType?: AlertType;
  predictionOutcome?: 'FALSE_POSITIVE' | 'TRUE_POSITIVE' | 'FALSE_NEGATIVE' | 'TRUE_NEGATIVE';
  note: string;
  status: CaseStatus;
}

export interface UpdateAlertDto {
  confidence_per?: number;
  priority?: Priority;
  alert_type?: AlertType;
  note?: string;
}

export interface ConvertToCaseDto {
  priority: Priority;
  caseType: 'FRAUD' | 'AML' | 'FRAUD_AND_AML';
  caseOwnerUserId?: string;
  riskCategory?: string;
  riskScore?: number;
  riskComponents?: RiskComponent[];
}

export interface RiskComponent {
  id: number;
  wght: number;
}

export interface RiskCategory {
  id: number;
  result: number;
  ruleResults: RiskComponent[];
}

export interface ConvertToCaseResponse {
  case_id: number;
  alert_id: number;
  message: string;
  success: boolean;
}

export interface CloseAlertDto {
  status?: AlertStatus;
  reason: string;
}

export interface SubmitAlertDto {
  result: {
    message: string;
    report: unknown;
    transaction: unknown;
    networkMap: unknown;
  };
}


export interface ConvertToCaseData {
  caseId?: number;
  assignedTo?: string;
  caseOwnerUserId?: string;
  priority: 'new' | 'urgent' | 'critical' | 'breach' | Priority;
  caseType: CaseType;
  linkedCases: string[];
  notes: string;
  alertId: number;
}

export interface AlertTableColumn {
  key: keyof Alert | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, alert: Alert) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface AlertTableAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (alert: Alert) => void;
  color?: 'blue' | 'green' | 'red' | 'gray';
  disabled?: (alert: Alert) => boolean;
}

export interface AlertsSearchFilters {
  query: string;
  source: string;
  type: string;
  priority: string;
  status: string;
  timeRange: string;
  startDate?: string;
  endDate?: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  message: string;
  statusCode: number;
  error: string;
  timestamp?: string;
  path?: string;
  details?: Record<string, unknown>;
}

export interface ServiceResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
  loading?: boolean;
}

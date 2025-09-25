import React from 'react';

// Constants matching backend Prisma schema
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

// Action History types
export interface ActionHistory {
  audit_log_id: string;
  user_id: string;
  operation: string;
  entity_name: string;
  action_performed: string;
  outcome: string;
  performed_at: string;
}

// Type aliases

export const CaseType = {
  FRAUD: 'FRAUD',
  AML: 'AML',
  FRAUD_AND_AML: 'FRAUD_AND_AML',
} as const;

export const CaseCreationType = {
  MANUAL: 'MANUAL',
  ALERT_CONVERSION: 'ALERT_CONVERSION',
} as const;

// Type unions from constants
export type Priority = (typeof Priority)[keyof typeof Priority];
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];
export type AlertType = (typeof AlertType)[keyof typeof AlertType];
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];
export type CaseType = (typeof CaseType)[keyof typeof CaseType];
export type CaseCreationType =
  (typeof CaseCreationType)[keyof typeof CaseCreationType];

// Core Alert interface matching backend schema
export interface Alert extends Record<string, unknown> {
  alert_id: string;
  tenant_id: string;
  priority: Priority;
  alert_type?: AlertType | null;
  source?: string;
  txtp?: string;
  message: string;
  alert_data: unknown;
  transaction: unknown;
  network_map: unknown;
  confidence_per: number;
  created_at: string;
  case_id?: string;
  prediction_outcome?: string;
}

// Case interface matching backend schema
export interface Case {
  case_id: string;
  case_creator_user_id: string;
  case_owner_user_id: string;
  tenant_id: string;
  status: CaseStatus;
  priority: Priority;
  created_at: string;
  updated_at: string;
  parent_id?: string;
  case_type: CaseType;
  case_creation_type: CaseCreationType;
}

// Filter interface for alerts API
export interface AlertsFilter {
  priority?: string;
  status?: string;
  type?: string;
  alertType?: string;
  source?: string;
  search?: string;
  reportStatus?: string; // Added support for reportStatus filtering
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Pagination response interface
export interface PaginationResponse {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

// Alerts API response interface
export interface AlertsApiResponse {
  alerts: Alert[];
  pagination: PaginationResponse;
}

// DTO interfaces matching backend DTOs

// Manual Triage DTO - matches backend ManualTriageDto
export interface ManualTriageDto {
  confidence_per?: number;
  priority?: Priority;
  priorityScore: number;
  alertType?: AlertType;
  predictionOutcome?: 'FALSE_POSITIVE' | 'TRUE_POSITIVE' | 'FALSE_NEGATIVE' | 'TRUE_NEGATIVE';
  note: string;
  status: CaseStatus;
}

// Update Alert DTO
export interface UpdateAlertDto {
  confidence_per?: number;
  priority?: Priority;
  alert_type?: AlertType;
  note?: string;
}

// Convert Alert to Case DTO
export interface ConvertToCaseDto {
  priority: Priority;
  caseType: 'FRAUD' | 'AML' | 'FRAUD_AND_AML';
  caseOwnerUserId?: string;
  // Optional risk info extracted from alert.alert_data.tadpResult.typologyResult[0]
  riskCategory?: string;
  riskScore?: number;
  riskComponents?: RiskComponent[];
}

// Risk types extracted from alert data
export interface RiskComponent {
  id: string;
  wght: number;
}

export interface RiskCategory {
  id: string;
  result: number;
  ruleResults: RiskComponent[];
}

// Convert Alert to Case Response
export interface ConvertToCaseResponse {
  case_id: string;
  alert_id: string;
  message: string;
  success: boolean;
}

// Close Alert DTO
export interface CloseAlertDto {
  status?: AlertStatus;
  reason: string;
}

// Submit Alert DTO (for reference)
export interface SubmitAlertDto {
  result: {
    message: string;
  report: unknown;
  transaction: unknown;
  networkMap: unknown;
  };
}

// UI-specific interfaces for components

// Convert to Case Modal Data
export interface ConvertToCaseData {
  caseId?: string;
  assignedTo?: string;
  caseOwnerUserId?: string;
  // UI uses lowercase priority values ('new'|'urgent'|'critical'|'breach'), but backend uses uppercase Priority.
  priority: 'new' | 'urgent' | 'critical' | 'breach' | Priority;
  caseType: CaseType;
  linkedCases: string[];
  notes: string;
  alertId: string;
}

// Alert table column configuration
export interface AlertTableColumn {
  key: keyof Alert | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, alert: Alert) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

// Alert table action configuration
export interface AlertTableAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (alert: Alert) => void;
  color?: 'blue' | 'green' | 'red' | 'gray';
  disabled?: (alert: Alert) => boolean;
}

// Search and filters for UI
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

// API Error interface
export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
  details?: unknown;
}

// Enhanced API Error Response interface
export interface ApiErrorResponse {
  message: string;
  statusCode: number;
  error: string;
  timestamp?: string;
  path?: string;
  details?: Record<string, unknown>;
}

// Service response wrapper
export interface ServiceResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
  loading?: boolean;
}

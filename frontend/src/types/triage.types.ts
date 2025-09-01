import React from 'react';

// Constants matching backend Prisma schema
export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
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
  TRANSACTION_MONITORING: 'TRANSACTION_MONITORING',
  SANCTIONS_SCREENING: 'SANCTIONS_SCREENING',
  AML_SCREENING: 'AML_SCREENING',
  FRAUD_DETECTION: 'FRAUD_DETECTION',
} as const;

export const CaseStatus = {
  OPEN: 'OPEN',
  INVESTIGATING: 'INVESTIGATING',
  CLOSED: 'CLOSED',
  ESCALATED: 'ESCALATED',
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
export interface Alert {
  alert_id: string;
  tenant_id: string;
  priority: Priority;
  alert_type?: AlertType;
  source?: string;
  txtp?: string;
  message: string;
  alert_data: unknown;
  transaction: unknown;
  network_map: unknown;
  alert_status: AlertStatus;
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

// Update Alert DTO
export interface UpdateAlertDto {
  confidence_per?: number;
  priority?: Priority;
  alertType?: AlertType;
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
  // UI uses lowercase priority values ('low'|'medium'|'high'), but backend uses uppercase Priority.
  // Accept either so UI and API mapping are both supported.
  priority: 'low' | 'medium' | 'high' | Priority;
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

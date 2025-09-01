export type {
  Priority,
  AlertStatus,
  AlertType,
  CaseStatus,
  CaseType,
  CaseCreationType,
  Case,
  AlertsFilter,
  PaginationResponse,
  AlertsApiResponse,
  UpdateAlertDto,
  ConvertToCaseDto,
  CloseAlertDto,
  SubmitAlertDto,
  ConvertToCaseData,
  AlertTableColumn,
  AlertTableAction,
  AlertsSearchFilters,
  ApiError,
  ServiceResponse,
} from './triage.types';

// Export the Alert types with specific names to avoid conflicts
export type { Alert as TriageAlert } from './triage.types';
export type {
  Alert as UIAlert,
  TransactionMessage,
} from './alertsdashboard.types';

// Export the constants
export {
  Priority as PriorityValues,
  AlertStatus as AlertStatusValues,
  AlertType as AlertTypeValues,
  CaseStatus as CaseStatusValues,
  CaseType as CaseTypeValues,
  CaseCreationType as CaseCreationTypeValues,
} from './triage.types';

// Utility functions
export * from '../utils/alertTransformers';

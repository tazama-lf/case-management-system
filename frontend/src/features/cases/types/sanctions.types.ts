/**
 * Sanctions Screening Types
 * Types for managing sanctions screening reports and evidence
 */

export interface SanctionsScreening {
  screening_id: string;
  case_id: string;
  task_id?: string; // Link to Investigation task
  evidence_id?: string; // Link to uploaded evidence file

  // Screening details
  screening_date: string;
  tool_source: string; // e.g., "WorldCheck", "Dow Jones", "ComplyAdvantage"
  reference_id?: string; // External tool reference ID

  // Screening result
  disposition: SanctionsDisposition;
  match_count: number;
  summary: string;

  // Uploader info
  investigator_id: string;
  investigator_name?: string;
  uploaded_at: string;

  // File details
  file_name?: string;
  file_type?: string;
  file_size?: number;

  // Metadata
  metadata?: SanctionsMetadata;

  // Audit
  last_updated_at?: string;
  last_updated_by?: string;
}

export type SanctionsDisposition =
  | 'CLEARED'
  | 'POSITIVE_MATCH'
  | 'FALSE_POSITIVE'
  | 'ESCALATED'
  | 'PENDING_REVIEW'
  | 'REQUIRES_INVESTIGATION';

export interface SanctionsMetadata {
  // Screening details
  entities_screened?: number;
  watchlists_checked?: string[];
  confidence_score?: number;

  // Match details
  matched_names?: string[];
  matched_entities?: MatchedEntity[];
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Processing info
  screening_duration_ms?: number;
  api_version?: string;

  [key: string]:
    | string
    | number
    | boolean
    | string[]
    | MatchedEntity[]
    | undefined;
}

export interface MatchedEntity {
  entity_name: string;
  entity_type: 'INDIVIDUAL' | 'ORGANIZATION' | 'VESSEL' | 'OTHER';
  match_score: number;
  watchlist: string;
  category: string;
  details?: string;
}

export interface CreateSanctionsScreeningDto {
  case_id: string;
  task_id?: string;

  // Required screening details
  screening_date: string;
  tool_source: string;
  disposition: SanctionsDisposition;
  summary: string;

  // Optional details
  reference_id?: string;
  match_count?: number;

  // File upload
  file?: File;

  // Metadata
  metadata?: Partial<SanctionsMetadata>;
}

export interface UpdateSanctionsScreeningDto {
  screening_id: string;

  // Updatable fields
  screening_date?: string;
  tool_source?: string;
  disposition?: SanctionsDisposition;
  summary?: string;
  reference_id?: string;
  match_count?: number;
  metadata?: Partial<SanctionsMetadata>;
}

export interface SanctionsScreeningResponse {
  screening: SanctionsScreening;
  message: string;
  success: boolean;
}

export interface SanctionsScreeningListResponse {
  screenings: SanctionsScreening[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DeleteSanctionsScreeningResponse {
  success: boolean;
  message: string;
  screening_id: string;
}

export interface SanctionsScreeningFilters {
  case_id?: string;
  task_id?: string;
  disposition?: SanctionsDisposition;
  tool_source?: string;
  date_from?: string;
  date_to?: string;
  investigator_id?: string;
  search?: string;
}

export interface SanctionsScreeningAuditLog {
  log_id: string;
  screening_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'DOWNLOAD' | 'VIEW';
  user_id: string;
  user_name?: string;
  timestamp: string;
  details?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ip_address?: string;
}

export interface SanctionsScreeningStatistics {
  total_screenings: number;
  by_disposition: Record<SanctionsDisposition, number>;
  by_tool_source: Record<string, number>;
  recent_screenings: number;
  high_risk_count: number;
  pending_review_count: number;
}

// UI-specific types
export interface SanctionsScreeningFormData {
  screening_date: string;
  tool_source: string;
  reference_id: string;
  disposition: SanctionsDisposition;
  match_count: number;
  summary: string;
  file?: File;

  // Advanced metadata
  entities_screened?: number;
  watchlists_checked?: string;
  confidence_score?: number;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const SANCTIONS_TOOLS = [
  'WorldCheck',
  'Dow Jones Risk & Compliance',
  'ComplyAdvantage',
  'LexisNexis Bridger',
  'Refinitiv World-Check',
  'ACAMS',
  'SAS Anti-Money Laundering',
  'Other',
] as const;

export const DISPOSITION_OPTIONS: Array<{
  value: SanctionsDisposition;
  label: string;
  color: string;
  icon: '✓' | '!' | '?' | '↑' | '○' | '◉';
}> = [
  { value: 'CLEARED', label: 'Cleared', color: 'green', icon: '✓' },
  { value: 'POSITIVE_MATCH', label: 'Positive Match', color: 'red', icon: '!' },
  {
    value: 'FALSE_POSITIVE',
    label: 'False Positive',
    color: 'yellow',
    icon: '?',
  },
  { value: 'ESCALATED', label: 'Escalated', color: 'orange', icon: '↑' },
  {
    value: 'PENDING_REVIEW',
    label: 'Pending Review',
    color: 'blue',
    icon: '○',
  },
  {
    value: 'REQUIRES_INVESTIGATION',
    label: 'Requires Investigation',
    color: 'purple',
    icon: '◉',
  },
];

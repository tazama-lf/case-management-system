export interface Evidence {
  evidence_id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_hash: string; // SHA-256 hash for integrity
  storage_path: string;
  uploader_id: string;
  uploader_name?: string;
  uploaded_at: string;
  tags: string[];
  evidence_type: EvidenceType;
  description?: string;
  metadata?: EvidenceMetadata;
  verified: boolean;
  verification_date?: string;
  verified_by?: string;
  access_level: 'PUBLIC' | 'CONFIDENTIAL' | 'RESTRICTED';
}

export type EvidenceType = 
  | 'DOCUMENT'
  | 'SCREENSHOT'
  | 'LOG_FILE'
  | 'TRANSACTION_RECORD'
  | 'COMMUNICATION'
  | 'MEDIA'
  | 'OTHER';

export interface EvidenceMetadata {
  original_name?: string;
  mime_type?: string;
  source?: string;
  related_alert_id?: string;
  related_transaction_id?: string;
  capture_timestamp?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface UploadEvidenceDto {
  file: File;
  case_id: string;
  tags: string[];
  evidence_type: EvidenceType;
  description?: string;
  access_level?: 'PUBLIC' | 'CONFIDENTIAL' | 'RESTRICTED';
  metadata?: Partial<EvidenceMetadata>;
}

export interface UploadEvidenceResponse {
  evidence: Evidence;
  message: string;
  success: boolean;
}

export interface VerifyEvidenceDto {
  evidence_id: string;
  expected_hash?: string;
}

export interface VerifyEvidenceResponse {
  evidence_id: string;
  verified: boolean;
  hash_match: boolean;
  current_hash: string;
  expected_hash: string;
  verification_date: string;
  verified_by: string;
  message: string;
}

export interface EvidenceSearchFilters {
  evidence_type?: EvidenceType;
  tags?: string[];
  uploader_id?: string;
  date_from?: string;
  date_to?: string;
  verified?: boolean;
  search?: string;
}

export interface EvidenceListResponse {
  evidence: Evidence[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DeleteEvidenceResponse {
  success: boolean;
  message: string;
  evidence_id: string;
}

export interface DownloadEvidenceResponse {
  url: string;
  evidence_id: string;
  file_name: string;
  expires_at: string;
}

export interface EvidenceAuditLog {
  log_id: string;
  evidence_id: string;
  action: 'UPLOAD' | 'DOWNLOAD' | 'VERIFY' | 'DELETE' | 'UPDATE';
  user_id: string;
  user_name?: string;
  timestamp: string;
  details?: string;
  ip_address?: string;
}

export interface EvidenceStatistics {
  total_count: number;
  total_size: number;
  by_type: Record<EvidenceType, number>;
  recent_uploads: number;
  verified_count: number;
  unverified_count: number;
}

export interface Evidence {
  id: string; // Evidence ID
  taskId: string; // Task ID this evidence belongs to
  caseId?: string; // Case ID (derived from task)
  fileName: string;
  originalName?: string;
  fileSize: number;
  mimeType: string;
  hash: string; // SHA-256 hash for integrity
  filePath: string;
  uploadedBy: string;
  uploadedAt: Date | string;
  tags?: string;
  evidenceType: EvidenceType;
  description?: string;
  comments?: string;
  verified?: boolean;
  downloadUrl?: string;
  
  // Sanctions specific fields
  screeningDate?: string;
  tool?: string;
  summaryDisposition?: string;
  
  // Adverse Media specific fields
  aggregator?: string;
  dateSearched?: string;
  keywords?: string[];
  findings?: string;
}

export type EvidenceType =
  | 'SANCTIONS'
  | 'ADVERSE_MEDIA'
  | 'OTHER';

export interface EvidenceMetadata {
  screeningDate?: string;
  tool?: string;
  summaryDisposition?: string;
  aggregator?: string;
  dateSearched?: string;
  keywords?: string[];
  findings?: string;
  [key: string]: string | string[] | number | boolean | undefined;
}

export interface UploadEvidenceDto {
  file: File;
  taskId: string;
  evidenceType: EvidenceType;
  tags?: string;
  description?: string;
  comments?: string;
  
  // Sanctions specific fields
  screeningDate?: string;
  tool?: string;
  summaryDisposition?: string;
  
  // Adverse Media specific fields
  aggregator?: string;
  dateSearched?: string;
  keywords?: string[];
  findings?: string;
}

export interface UploadEvidenceResponse {
  id: string;
  taskId: string;
  fileName: string;
  evidenceType: EvidenceType;
  fileSize: number;
  mimeType: string;
  hash: string;
  uploadedBy: string;
  uploadedAt: Date;
  tags?: string;
  description?: string;
  comments?: string;
  filePath: string;
}

export interface VerifyEvidenceDto {
  evidenceId: string;
  expectedHash: string;
}

export interface VerifyEvidenceResponse {
  evidenceId: string;
  expectedHash: string;
  verified: boolean;
  message: string;
  verifiedAt: Date;
  verifiedBy: string;
}

export interface EvidenceSearchFilters {
  evidenceType?: EvidenceType;
  taskId?: string;
  uploadedBy?: string;
  verified?: boolean;
  search?: string;
}

export interface EvidenceListResponse {
  evidence: Evidence[];
  total: number;
  taskId?: string;
  evidenceType?: EvidenceType;
}

export interface DeleteEvidenceResponse {
  success: boolean;
  message: string;
  evidenceId: string;
}

export interface DownloadEvidenceResponse {
  file: Buffer | Blob;
  metadata: Evidence;
}

export interface EvidenceAuditLog {
  logId: string;
  evidenceId: string;
  action: 'UPLOAD' | 'DOWNLOAD' | 'VERIFY' | 'DELETE' | 'UPDATE' | 'VIEW';
  userId: string;
  userName?: string;
  timestamp: Date | string;
  details?: string;
}

export interface EvidenceStatistics {
  totalCount: number;
  totalSize: number;
  byType: Record<EvidenceType, number>;
  verifiedCount: number;
  unverifiedCount: number;
}

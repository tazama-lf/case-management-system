export interface EvidenceAttachment {
  fileName: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
  hash: string;
  encryption?: {
    key: string;
    iv: string;
    authTag: string;
  };
}

export interface Evidence {
  id: number; // Evidence ID
  taskId: number; // Task ID this evidence belongs to
  caseId?: number; // Case ID (derived from task)
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
  attachments?: EvidenceAttachment[]; // CouchDB attachments array

  // Sanctions specific fields
  screeningDate?: string;
  tool?: string;
  summaryDisposition?: string;

  // Adverse Media specific fields
  aggregator?: string;
  dateSearched?: string;
  keywords?: string[];
  findings?: string;

  // SAR/STR Filing specific fields
  submissionDate?: string;
  referenceNumber?: string;
  submissionChannel?: string;
}

export type EvidenceType =
  | 'SANCTIONS'
  | 'ADVERSE_MEDIA'
  | 'OTHER'
  | 'SAR_STR_FILING'
  | 'SCREENSHOT'
  | 'MEDIA'
  | 'LOG_FILE'
  | 'KYC'
  | 'EDD';

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
  taskId: number;
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

  // SAR/STR Filing specific fields
  submissionDate?: string;
  referenceNumber?: string;
  submissionChannel?: string;
}

export interface UploadEvidenceResponse {
  id: number;
  taskId: number;
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
  evidenceId: number;
  expectedHash: string;
}

export interface VerifyEvidenceResponse {
  evidenceId: number;
  expectedHash: string;
  verified: boolean;
  message: string;
  verifiedAt: Date;
  verifiedBy: string;
}

export interface EvidenceSearchFilters {
  evidenceType?: EvidenceType;
  taskId?: number;
  uploadedBy?: string;
  verified?: boolean;
  search?: string;
}

export interface EvidenceListResponse {
  evidence: Evidence[];
  total: number;
  taskId?: number;
  evidenceType?: EvidenceType;
}

export interface DeleteEvidenceResponse {
  success: boolean;
  message: string;
  evidenceId: number;
}

export interface DownloadEvidenceResponse {
  file: Buffer | Blob;
  metadata: Evidence;
}

export interface EvidenceAuditLog {
  logId: number;
  evidenceId: number;
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

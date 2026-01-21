export interface EvidenceAttachment {
  fileName: string;
  fileSize: number;
  filePath: string;
  mimeType: string;
  hash: string;
  submittedAt?: string;
  encryption?: {
    key: string;
    iv: string;
    authTag: string;
  };
}

export interface Evidence {
  id: string; // Evidence ID
  taskId: number; // Task ID this evidence belongs to
  caseId?: number; // Case ID (derived from task)
  reportId?: string; // Report ID for investigation reports
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
  | 'KYC'
  | 'EDD'

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

export interface Attachment {
  fileName: string;
  fileSize: number | null;
  filePath: string;
  mimeType: string;
  hash: string;                // unique identifier for the file
  encryption?: {
    key: string;
    iv: string;
    authTag: string;
  };
  caseType?: string;
  investigator?: string;
  supervisor?: string;
  description?: string;
  submittedAt: string;         // ISO string
  [key: string]: any;          // allow extra fields if needed
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
  id: string;
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
  evidenceId: string;
}

export interface DownloadEvidenceResponse {
  file: Buffer | Blob;
  metadata: Evidence;
}

export interface EvidenceAuditLog {
  logId: number;
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

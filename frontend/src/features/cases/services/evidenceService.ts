import apiClient from '../../../shared/services/apiClient';
import type {
  Evidence,
  UploadEvidenceDto,
  UploadEvidenceResponse,
  VerifyEvidenceResponse,
  EvidenceListResponse,
  EvidenceType,
} from '../types/evidence.types';

export class EvidenceService {
  private baseUrl = '/api/v1/evidence';

  /**
   * Upload evidence file with metadata
   * Maps to: POST /api/v1/evidence/upload
   */
  async uploadEvidence(
    data: UploadEvidenceDto,
  ): Promise<UploadEvidenceResponse> {
    try {
      const formData = new FormData();
      formData.append('files', data.file);
      formData.append('taskId', data.taskId);
      formData.append('evidenceType', data.evidenceType);

      if (data.tags) {
        formData.append('tags', data.tags);
      }

      if (data.description) {
        formData.append('description', data.description);
      }

      if (data.comments) {
        formData.append('comments', data.comments);
      }

      // Sanctions specific fields
      if (data.evidenceType === 'SANCTIONS') {
        if (data.screeningDate) {
          formData.append('screeningDate', data.screeningDate);
        }
        if (data.tool) {
          formData.append('tool', data.tool);
        }
        if (data.summaryDisposition) {
          formData.append('summaryDisposition', data.summaryDisposition);
        }
      }

      // Adverse Media specific fields
      if (data.evidenceType === 'ADVERSE_MEDIA') {
        if (data.aggregator) {
          formData.append('aggregator', data.aggregator);
        }
        if (data.dateSearched) {
          formData.append('dateSearched', data.dateSearched);
        }
        if (data.keywords && data.keywords.length > 0) {
          formData.append('keywords', JSON.stringify(data.keywords));
        }
        if (data.findings) {
          formData.append('findings', data.findings);
        }
      }

      const response = await apiClient.upload<UploadEvidenceResponse>(
        `${this.baseUrl}/upload`,
        formData,
      );

      return response;
    } catch (error) {
      throw this.handleError(error, 'upload evidence');
    }
  }

  /**
   * Get all evidence for a specific task
   * Maps to: GET /api/v1/evidence/task/:taskId
   */
  async getTaskEvidence(taskId: string): Promise<EvidenceListResponse> {
    try {
      const response = await apiClient.get<EvidenceListResponse>(
        `${this.baseUrl}/task/${taskId}`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'get task evidence');
    }
  }

  /**
   * Get all evidence for a specific case
   * Maps to: GET /api/v1/evidence/case/:caseId
   */
  async getCaseEvidence(caseId: string): Promise<EvidenceListResponse> {
    try {
      const response = await apiClient.get<EvidenceListResponse>(
        `${this.baseUrl}/case/${caseId}`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'get case evidence');
    }
  }

  /**
   * Get evidence by type
   * Maps to: GET /api/v1/evidence/evidenceType/:evidenceType
   */
  async getEvidenceByType(
    evidenceType: EvidenceType,
  ): Promise<EvidenceListResponse> {
    try {
      const response = await apiClient.get<EvidenceListResponse>(
        `${this.baseUrl}/evidenceType/${evidenceType}`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'get evidence by type');
    }
  }

  /**
   * Get evidence details by ID
   * Maps to: GET /api/v1/evidence/:id
   */
  async getEvidenceById(evidenceId: string): Promise<Evidence> {
    try {
      const response = await apiClient.get<Evidence>(
        `${this.baseUrl}/${evidenceId}`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'get evidence details');
    }
  }

  /**
   * Verify evidence integrity using SHA-256 hash
   * Maps to: GET /api/v1/evidence/:id/verify
   */
  async verifyEvidence(
    evidenceId: string,
  ): Promise<VerifyEvidenceResponse> {
    try {
      const response = await apiClient.get<VerifyEvidenceResponse>(
        `${this.baseUrl}/${evidenceId}/verify`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'verify evidence');
    }
  }

  /**
   * Download evidence file
   * Maps to: GET /api/v1/evidence/:id/download
   */
  async downloadEvidence(evidenceId: string): Promise<Blob> {
    try {
      // Direct fetch for blob response
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const response = await fetch(
        `${this.baseUrl}/${evidenceId}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to download evidence');
      }

      return await response.blob();
    } catch (error) {
      throw this.handleError(error, 'download evidence');
    }
  }

  /**
   * Calculate client-side SHA-256 hash for verification
   */
  async calculateFileHash(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return hashHex;
    } catch (error) {
      console.error('Error calculating file hash:', error);
      throw new Error('Failed to calculate file hash');
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(
    file: File,
    maxSizeMB: number = 50,
  ): { valid: boolean; error?: string } {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds ${maxSizeMB}MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    // Check file type (basic validation)
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml',
      'application/zip',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type) && file.type !== '') {
      return {
        valid: false,
        error: `File type not allowed: ${file.type}. Please upload documents, images, or common file formats.`,
      };
    }

    return { valid: true };
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private handleError(error: unknown, operation: string): Error {
    console.error(`EvidenceService Error - ${operation}:`, error);

    if (error instanceof Error) {
      return error;
    }

    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    if (err?.response?.data) {
      return new Error(err.response.data.message || `Failed to ${operation}`);
    }

    if (err?.message) {
      return new Error(err.message);
    }

    return new Error(`Failed to ${operation}`);
  }
}

export const evidenceService = new EvidenceService();

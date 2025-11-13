import apiClient from '../../../shared/services/apiClient';
import type {
  Evidence,
  UploadEvidenceDto,
  UploadEvidenceResponse,
  VerifyEvidenceDto,
  VerifyEvidenceResponse,
  EvidenceSearchFilters,
  EvidenceListResponse,
  DeleteEvidenceResponse,
  DownloadEvidenceResponse,
  EvidenceAuditLog,
  EvidenceStatistics,
} from '../types/evidence.types';

export class EvidenceService {
  private baseUrl = '/api/v1/evidence';

  /**
   * Upload evidence file with metadata
   */
  async uploadEvidence(
    data: UploadEvidenceDto,
  ): Promise<UploadEvidenceResponse> {
    try {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('case_id', data.case_id);
      formData.append('tags', JSON.stringify(data.tags));
      formData.append('evidence_type', data.evidence_type);

      if (data.description) {
        formData.append('description', data.description);
      }

      if (data.access_level) {
        formData.append('access_level', data.access_level);
      }

      if (data.metadata) {
        formData.append('metadata', JSON.stringify(data.metadata));
      }

      const response = await apiClient.upload<UploadEvidenceResponse>(
        this.baseUrl,
        formData,
      );

      return response;
    } catch (error) {
      throw this.handleError(error, 'upload evidence');
    }
  }

  /**
   * Get all evidence for a specific case
   */
  async getCaseEvidence(
    caseId: string,
    filters?: EvidenceSearchFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<EvidenceListResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (filters?.evidence_type) {
        params.append('evidence_type', filters.evidence_type);
      }
      if (filters?.tags && filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','));
      }
      if (filters?.uploader_id) {
        params.append('uploader_id', filters.uploader_id);
      }
      if (filters?.date_from) {
        params.append('date_from', filters.date_from);
      }
      if (filters?.date_to) {
        params.append('date_to', filters.date_to);
      }
      if (filters?.verified !== undefined) {
        params.append('verified', filters.verified.toString());
      }
      if (filters?.search) {
        params.append('search', filters.search);
      }

      const queryString = params.toString();
      const url = `${this.baseUrl}/case/${caseId}${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<EvidenceListResponse>(url);
      return response;
    } catch (error) {
      throw this.handleError(error, 'get case evidence');
    }
  }

  /**
   * Get evidence details by ID
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
   */
  async verifyEvidence(
    data: VerifyEvidenceDto,
  ): Promise<VerifyEvidenceResponse> {
    try {
      const response = await apiClient.post<VerifyEvidenceResponse>(
        `${this.baseUrl}/${data.evidence_id}/verify`,
        { expected_hash: data.expected_hash },
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'verify evidence');
    }
  }

  /**
   * Download evidence file
   */
  async downloadEvidence(
    evidenceId: string,
  ): Promise<DownloadEvidenceResponse> {
    try {
      const response = await apiClient.get<DownloadEvidenceResponse>(
        `${this.baseUrl}/${evidenceId}/download`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'download evidence');
    }
  }

  /**
   * Delete evidence (soft delete with audit trail)
   */
  async deleteEvidence(
    evidenceId: string,
    reason?: string,
  ): Promise<DeleteEvidenceResponse> {
    try {
      const response = await apiClient.delete<DeleteEvidenceResponse>(
        `${this.baseUrl}/${evidenceId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'delete evidence');
    }
  }

  /**
   * Update evidence metadata
   */
  async updateEvidenceMetadata(
    evidenceId: string,
    updates: Partial<
      Pick<Evidence, 'tags' | 'description' | 'evidence_type' | 'access_level'>
    >,
  ): Promise<Evidence> {
    try {
      const response = await apiClient.patch<Evidence>(
        `${this.baseUrl}/${evidenceId}`,
        updates,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'update evidence metadata');
    }
  }

  /**
   * Get evidence audit log
   */
  async getEvidenceAuditLog(evidenceId: string): Promise<EvidenceAuditLog[]> {
    try {
      const response = await apiClient.get<{ logs: EvidenceAuditLog[] }>(
        `${this.baseUrl}/${evidenceId}/audit-log`,
      );
      return response.logs;
    } catch (error) {
      throw this.handleError(error, 'get evidence audit log');
    }
  }

  /**
   * Get evidence statistics for a case
   */
  async getCaseEvidenceStatistics(caseId: string): Promise<EvidenceStatistics> {
    try {
      const response = await apiClient.get<EvidenceStatistics>(
        `${this.baseUrl}/case/${caseId}/statistics`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'get evidence statistics');
    }
  }

  /**
   * Search evidence across all cases (for registry)
   */
  async searchEvidence(
    filters: EvidenceSearchFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<EvidenceListResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (filters.evidence_type) {
        params.append('evidence_type', filters.evidence_type);
      }
      if (filters.tags && filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','));
      }
      if (filters.uploader_id) {
        params.append('uploader_id', filters.uploader_id);
      }
      if (filters.date_from) {
        params.append('date_from', filters.date_from);
      }
      if (filters.date_to) {
        params.append('date_to', filters.date_to);
      }
      if (filters.verified !== undefined) {
        params.append('verified', filters.verified.toString());
      }
      if (filters.search) {
        params.append('search', filters.search);
      }

      const queryString = params.toString();
      const url = `${this.baseUrl}/search${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<EvidenceListResponse>(url);
      return response;
    } catch (error) {
      throw this.handleError(error, 'search evidence');
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

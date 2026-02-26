import apiClient from '../../../shared/services/apiClient';
import type {
  Evidence,
  UploadEvidenceDto,
  UploadEvidenceResponse,
  VerifyEvidenceResponse,
  EvidenceListResponse,
  EvidenceType,
  EvidenceSearchFilters,
} from '../types/evidence.types';

export class EvidenceService {
  private readonly baseUrl = '/api/v1/evidence';

  private normalizeEvidenceData(evidence: any): any {
    if (!evidence) return evidence;

    const firstAttachment = evidence.attachments?.[0];

    const totalFileSize =
      evidence.fileSize ??
      (evidence.attachments?.reduce(
        (sum: number, att: any) => sum + (att.fileSize || 0),
        0,
      ) ||
        0);

    return {
      ...evidence,
      fileName: evidence.fileName || firstAttachment?.fileName || 'unknown',
      fileSize: evidence.fileSize ? evidence.fileSize : totalFileSize,
      file_size: evidence.file_size ? evidence.file_size : totalFileSize,
      mimeType:
        evidence.mimeType ||
        firstAttachment?.mimeType ||
        'application/octet-stream',
      hash: evidence.hash || firstAttachment?.hash || '',
    };
  }

  async uploadEvidence(
    data: UploadEvidenceDto,
  ): Promise<UploadEvidenceResponse> {
    try {
      const formData = new FormData();
      formData.append('files', data.file);
      formData.append('taskId', data.taskId.toString());
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

  async getTaskEvidence(taskId: number): Promise<EvidenceListResponse> {
    try {
      const response = await apiClient.get<EvidenceListResponse>(
        `${this.baseUrl}/task/${taskId}`,
      );
      response.evidence &&= response.evidence.map((e) =>
        this.normalizeEvidenceData(e),
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'get task evidence');
    }
  }

  async getCaseEvidence(caseId: number): Promise<EvidenceListResponse> {
    try {
      const response = await apiClient.get<EvidenceListResponse>(
        `${this.baseUrl}/case/${caseId}`,
      );
      response.evidence &&= response.evidence.map((e) =>
        this.normalizeEvidenceData(e),
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'get case evidence');
    }
  }

  async getEvidenceByType(
    evidenceType: EvidenceType,
  ): Promise<EvidenceListResponse> {
    try {
      const response = await apiClient.get<EvidenceListResponse>(
        `${this.baseUrl}/evidenceType/${evidenceType}`,
      );

      response.evidence &&= response.evidence.map((e) =>
        this.normalizeEvidenceData(e),
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'get evidence by type');
    }
  }

  async getEvidenceById(evidenceId: string): Promise<Evidence> {
    try {
      const response = await apiClient.get<Evidence>(
        `${this.baseUrl}/${evidenceId}`,
      );
      return this.normalizeEvidenceData(response);
    } catch (error) {
      throw this.handleError(error, 'get evidence details');
    }
  }

  async verifyEvidence(evidenceId: string): Promise<VerifyEvidenceResponse> {
    try {
      const response = await apiClient.get<VerifyEvidenceResponse>(
        `${this.baseUrl}/${evidenceId}/verify`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'verify evidence');
    }
  }

  async viewEvidence(evidenceId: string): Promise<Blob> {
    return await this.downloadEvidence(evidenceId);
  }

  async deleteEvidence(evidenceId: string, fileName: string): Promise<void> {
    try {
      await apiClient.delete<void>(
        `${this.baseUrl}/${evidenceId}/attachments/${encodeURIComponent(fileName)}`,
      );
    } catch (error) {
      throw this.handleError(error, 'delete evidence');
    }
  }

  async downloadEvidence(evidenceId: string): Promise<Blob> {
    const startTime = performance.now();

    try {
      const token =
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('authToken');

      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const baseApiUrl =
        import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';
      const url = `${baseApiUrl}${this.baseUrl}/${evidenceId}/download`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/octet-stream, */*',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        let errorMessage = `Server returned ${response.status}: ${response.statusText}`;

        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } else {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText.substring(0, 200);
            }
          }
        } catch (parseError) {
          console.error(
            '[Evidence Download] Error parsing error response:',
            parseError,
          );
        }

        console.error('[Evidence Download] Server error:', errorMessage);

        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error(
            'You do not have permission to access this evidence.',
          );
        } else if (response.status === 404) {
          throw new Error('Evidence file not found.');
        } else {
          throw new Error(errorMessage);
        }
      }

      const blob = await response.blob();
      const downloadTime = performance.now() - startTime;

      if (blob.size === 0) {
        throw new Error(
          'Received empty file from server. The file may be corrupted or deleted.',
        );
      }

      if (!blob.type || blob.type === 'application/octet-stream') {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType !== 'application/octet-stream') {
          return new Blob([blob], { type: contentType });
        }
      }

      return blob;
    } catch (error) {
      const downloadTime = performance.now() - startTime;
      console.error(
        '[Evidence Download] Failed after',
        downloadTime.toFixed(2),
        'ms:',
        error,
      );
      throw this.handleError(error, 'download evidence');
    }
  }

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

  validateFile(file: File, maxSizeMB = 50): { valid: boolean; error?: string } {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds ${maxSizeMB}MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      };
    }

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

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  }

  async searchEvidence(
    filters: EvidenceSearchFilters,
    page = 1,
    limit = 20,
  ): Promise<EvidenceListResponse> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (filters.evidenceType)
        {params.append('evidenceType', filters.evidenceType);}
      if (filters.taskId) params.append('taskId', filters.taskId.toString());
      if (filters.uploadedBy) params.append('uploadedBy', filters.uploadedBy);
      if (filters.verified !== undefined)
        {params.append('verified', filters.verified.toString());}
      if (filters.search) params.append('search', filters.search);

      const queryString = params.toString();
      const response = await apiClient.get<EvidenceListResponse>(
        `${this.baseUrl}/search?${queryString}`,
      );

      response.evidence &&= response.evidence.map((e) =>
        this.normalizeEvidenceData(e),
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'search evidence');
    }
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

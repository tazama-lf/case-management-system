/**
 * Sanctions Screening Service
 * Handles all API calls related to sanctions screening management
 */

import apiClient from '../../../shared/services/apiClient';
import type {
  SanctionsScreening,
  CreateSanctionsScreeningDto,
  UpdateSanctionsScreeningDto,
  SanctionsScreeningResponse,
  SanctionsScreeningListResponse,
  DeleteSanctionsScreeningResponse,
  SanctionsScreeningFilters,
  SanctionsScreeningAuditLog,
  SanctionsScreeningStatistics,
} from '../types/sanctions.types';

const BASE_URL = '/api/v1/sanctions-screenings';

/**
 * Get all sanctions screenings for a case
 */
export const getCaseSanctionsScreenings = async (
  caseId: string,
  filters?: SanctionsScreeningFilters,
): Promise<SanctionsScreeningListResponse> => {
  const params = new URLSearchParams();
  if (filters?.disposition) params.append('disposition', filters.disposition);
  if (filters?.tool_source) params.append('tool_source', filters.tool_source);
  if (filters?.date_from) params.append('date_from', filters.date_from);
  if (filters?.date_to) params.append('date_to', filters.date_to);
  if (filters?.investigator_id) {
    params.append('investigator_id', filters.investigator_id);
  }
  if (filters?.search) params.append('search', filters.search);

  const queryString = params.toString();
  const url = `${BASE_URL}/case/${caseId}${queryString ? `?${queryString}` : ''}`;

  return await apiClient.get<SanctionsScreeningListResponse>(url);
};

/**
 * Get a specific sanctions screening by ID
 */
export const getSanctionsScreening = async (
  screeningId: string,
): Promise<SanctionsScreening> =>
  await apiClient.get<SanctionsScreening>(`${BASE_URL}/${screeningId}`);

/**
 * Create a new sanctions screening with optional file upload
 */
export const createSanctionsScreening = async (
  dto: CreateSanctionsScreeningDto,
): Promise<SanctionsScreeningResponse> => {
  const formData = new FormData();

  // Add file if present
  if (dto.file) {
    formData.append('file', dto.file);
  }

  // Add all other fields as JSON
  formData.append('case_id', dto.case_id);
  if (dto.task_id) formData.append('task_id', dto.task_id);
  formData.append('screening_date', dto.screening_date);
  formData.append('tool_source', dto.tool_source);
  formData.append('disposition', dto.disposition);
  formData.append('summary', dto.summary);

  if (dto.reference_id) formData.append('reference_id', dto.reference_id);
  if (dto.match_count !== undefined) {
    formData.append('match_count', dto.match_count.toString());
  }
  if (dto.metadata) formData.append('metadata', JSON.stringify(dto.metadata));

  return await apiClient.post<SanctionsScreeningResponse>(BASE_URL, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * Update an existing sanctions screening
 */
export const updateSanctionsScreening = async (
  dto: UpdateSanctionsScreeningDto,
): Promise<SanctionsScreeningResponse> => {
  const { screening_id: screeningId, ...updateData } = dto;

  return await apiClient.patch<SanctionsScreeningResponse>(
    `${BASE_URL}/${screeningId}`,
    updateData,
  );
};

/**
 * Delete a sanctions screening
 */
export const deleteSanctionsScreening = async (
  screeningId: string,
): Promise<DeleteSanctionsScreeningResponse> =>
  await apiClient.delete<DeleteSanctionsScreeningResponse>(
    `${BASE_URL}/${screeningId}`,
  );

/**
 * Download the sanctions screening report file
 */
export const downloadSanctionsReport = async (
  screeningId: string,
): Promise<{ url: string; file_name: string }> => {
  const response = await apiClient.get<{ url: string; file_name: string }>(
    `${BASE_URL}/${screeningId}/download`,
  );

  // Trigger download
  const link = document.createElement('a');
  link.href = response.url;
  link.download = response.file_name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return response;
};

/**
 * Get audit logs for a sanctions screening
 */
export const getSanctionsScreeningAuditLogs = async (
  screeningId: string,
): Promise<SanctionsScreeningAuditLog[]> =>
  await apiClient.get<SanctionsScreeningAuditLog[]>(
    `${BASE_URL}/${screeningId}/audit-logs`,
  );

/**
 * Get sanctions screening statistics for a case
 */
export const getCaseSanctionsStatistics = async (
  caseId: string,
): Promise<SanctionsScreeningStatistics> =>
  await apiClient.get<SanctionsScreeningStatistics>(
    `${BASE_URL}/case/${caseId}/statistics`,
  );

/**
 * Search sanctions screenings across all cases (for registry)
 */
export const searchSanctionsScreenings = async (
  filters: SanctionsScreeningFilters,
  page = 1,
  limit = 20,
): Promise<SanctionsScreeningListResponse> => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  if (filters.case_id) params.append('case_id', filters.case_id);
  if (filters.task_id) params.append('task_id', filters.task_id);
  if (filters.disposition) params.append('disposition', filters.disposition);
  if (filters.tool_source) params.append('tool_source', filters.tool_source);
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);
  if (filters.investigator_id) {
    params.append('investigator_id', filters.investigator_id);
  }
  if (filters.search) params.append('search', filters.search);

  return await apiClient.get<SanctionsScreeningListResponse>(
    `${BASE_URL}/search?${params.toString()}`,
  );
};

/**
 * Validate file before upload
 */
export const validateScreeningFile = (
  file: File,
): { valid: boolean; error?: string } => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/json',
    'text/plain',
  ];

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 50MB limit. Current size: ${formatFileSize(file.size)}`,
    };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed types: PDF, Excel, CSV, JSON, TXT',
    };
  }

  return { valid: true };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

/**
 * Get disposition color class for UI
 */
export const getDispositionColor = (disposition: string): string => {
  const colorMap: Record<string, string> = {
    CLEARED: 'green',
    POSITIVE_MATCH: 'red',
    FALSE_POSITIVE: 'yellow',
    ESCALATED: 'orange',
    PENDING_REVIEW: 'blue',
    REQUIRES_INVESTIGATION: 'purple',
  };

  return colorMap[disposition] || 'gray';
};

/**
 * Get risk level color class for UI
 */
export const getRiskLevelColor = (riskLevel: string): string => {
  const colorMap: Record<string, string> = {
    LOW: 'green',
    MEDIUM: 'yellow',
    HIGH: 'orange',
    CRITICAL: 'red',
  };

  return colorMap[riskLevel] || 'gray';
};
